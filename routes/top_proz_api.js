const request = require('request');
const config = require('../config');
const express = require('express');
const router = express.Router();
const quickbookAPIObj = require('../routes/quickbook_api_call');
var tools = require('../tools/tools.js')

router.get('/', function (req, res) {

})

router.get('/DisconnectQB', function (req, res) {
  const loginId = req.session.loginId;
  const url = `${config.base_url}accountsetting/saveQuickBookKeys`;
  
  const options = {
    url: url,
    method: 'POST',
    headers: {
      'Authorization': config.topproz_token_id,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'loginId': loginId,
      'quickBookId': "",
      'accessToken': "",
      'refreshToken': ""
    })
  };
  
  request(options, function (err, response, body) {
    if (err || response.statusCode != 200) {
      return res.status(400).json({error: err, response: response});
    } else {
      console.log('Disconnect successful');
      return res.json(JSON.parse(body));
    }
  });
})

router.get('/getQuickBookKeysByLoginId/:loginId', function (req, res) {
const loginId = req.params.loginId;

getQuickBookKeysByLoginIdFunc(req,res,loginId, function (err, result) {
  if (err) {
    console.error('Error:', err);
    getTopProzNewToken(req, function (result, err) {
      if (err) {
        console.log('error: ' + err);
        addQuickBookLogs(loginId,err, err.statusCode );
        return false;
      } else {
        console.log('New Token Updated of TopProz');
        getQuickBookKeysByLoginIdFunc(req,res,loginId,null);
      }
    });
  }
    
});

});

function getQuickBookKeysByLoginIdFunc(req, res, loginId, callback) {
  // Make API request using topproz_token_id from session
  request({
    url: `${config.base_url}accountsetting/getQuickBookKeysByLoginId/${loginId}`,
    method: 'GET',
    headers: {
      'Authorization': config.topproz_token_id
    },
  }, function (err, response, body) {
    if (err) {
      console.error('Request error:', err);
      return res.status(500).json({ error: 'Internal server error', details: err });
    }

    if (!response) {
      console.error('No response received');
      return res.status(500).json({ error: 'No response received from server' });
    }

    if (response.statusCode !== 200) {
      console.log(response.statusCode + ' no record found ');
      req.session.loginId = loginId;  
      return callback(response.statusCode,null);
    }

    try {
      
      const parsedBody = JSON.parse(body);
      const quickBookId = parsedBody.data.quickBook.quickBookId;
      const accessToken = parsedBody.data.quickBook.accessToken;
      const refreshToken = parsedBody.data.quickBook.refreshToken;
      
      // Store relevant data in session for later use
      req.session.loginId = loginId;
      req.session.realmId = quickBookId;
      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken;

      // Send response with tokens or process them as needed
      res.json({
        quickBookId,
        accessToken,
        refreshToken
      });
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      return res.status(500).json({ error: 'Error parsing response', details: parseError });
    }
  });
}

router.get('/proCustomerDetails/:customerId', function (req, res) {
  const loginId = req.session.loginId;  
  const customerId = req.params.customerId;
  req.session.customerId = customerId;
  var isResponse = false;
  
    request({
      url: `${config.base_url}proCustomer/proCustomerDetails/${loginId}/${customerId}`,
      method: 'GET',
      headers: {
        'Authorization': config.topproz_token_id
      },
    }, function (err, response, body) {
      if (err) {
        console.error('Request error:', err);
        isResponse = true;
        addQuickBookLogs(loginId,"Internal server error geting TopProz customer", response.statusCode );
        return res.status(500).json({ error: 'Internal server error', details: err });
      }
  
      if (!response) {
        console.error('No response received');
        isResponse = true;
        addQuickBookLogs(loginId,"No response received from server while geting TopProz customer ", response.statusCode );
        return res.status(500).json({ error: 'No response received from server' });
      }
  
      if (response.statusCode !== 200) {
        console.log(response.statusCode + ' Customer not found ');
        req.session.loginId = loginId;
        isResponse = true;
        addQuickBookLogs(loginId,"No record found while geting TopProz customer", response.statusCode );
        return res.status(404).json({ error: response.statusCode + ' Customer not found' });
      }
      else{
      try {
        const parsedBody = JSON.parse(body);
        //res.json({parsedBody});
        addQuickBookLogs(loginId,"TopProz customer get successfully! ", response.statusCode );
        var customerData = {};
        if(!parsedBody.data.hasOwnProperty("quickBookId"))
        {
          customerData = {
            CompanyID: req.session.realmId,
            QBAccessToken: req.session.accessToken,
            FullyQualifiedName: parsedBody.data.businessName,
            EmailAddress: parsedBody.data.proEmailId,
            FreeFormNumber: parsedBody.data.phoneNumber,
            CountrySubDivisionCode: parsedBody.data.customerBillingAddress.country,
            City: parsedBody.data.customerBillingAddress.city,
            PostalCode: parsedBody.data.customerBillingAddress.zipCode,
            address: parsedBody.data.customerBillingAddress.address
          };
        }
        else
        {
        customerData = {
          CompanyID: req.session.realmId,
          QBAccessToken: req.session.accessToken,
          FullyQualifiedName: parsedBody.data.businessName,
          EmailAddress: parsedBody.data.proEmailId,
          FreeFormNumber: parsedBody.data.phoneNumber,
          CountrySubDivisionCode: parsedBody.data.customerBillingAddress.country,
          City: parsedBody.data.customerBillingAddress.city,
          PostalCode: parsedBody.data.customerBillingAddress.zipCode,
          address: parsedBody.data.customerBillingAddress.address,
          quickBookId: parsedBody.data.quickBookId
        };
      }
      
        const tryAddingCustomer = (customerData) => {
          quickbookAPIObj.addCustomerToQuickBooks(customerData, (error, result) => {
            if (error && error.statusCode === 401) {
                response.statusCode = error.statusCode;
                tools.checkForUnauthorized(req, { headers: { Authorization: `Bearer ${customerData.QBAccessToken}` } }, error, response)
                .then(() => {
                  customerData.QBAccessToken = req.session.accessToken;
                  //Update NewToken in TopProze DB
                  saveQuickBookKeys(req.session.realmId,customerData.QBAccessToken,req.session.refreshToken,req.session.loginId, function (err, result) {
                    if (err) {
                      addQuickBookLogs(loginId,err, err.statusCode );
                    } else {
                      console.log('New Token Updated in TopProz');
                      addQuickBookLogs(loginId,"New Access Token Updated in TopProz", result.statusCode );
                    }
                  });
                  //Add Customer in quickbook
                  quickbookAPIObj.addCustomerToQuickBooks(customerData, (retryError, retryResult) => {
                    if (retryError) {
                      addQuickBookLogs(loginId,retryError, retryError.statusCode );
                      if(isResponse == false)
                        return res.json({'retryError: ' : retryError});
                    }
                    //console.log(retryResult.Customer.Id);
                    quickbookAPIObj.updateCustomerQBID(req.session.loginId,req.session.customerId,retryResult.Customer.Id)
                    addQuickBookLogs(loginId,"Quickbook Id updated in TopProz customer", "200" );
                    const combinedResponse = {
                      customerDetails: parsedBody,
                      quickBooksResponse: retryResult
                    };
                    res.json(combinedResponse);
                  });
                })
                .catch(authError => {
                  addQuickBookLogs(loginId,authError, authError.statusCode );
                  if(isResponse == false)
                    {
                      res.redirect('/home')
                      //return res.json(authError);
                    }                    
                });
            } else if (error) {
                  console.log('customer is not adding qb');
                  addQuickBookLogs(loginId,error, 400 );
                  const combinedResponse = {
                    customerDetails: parsedBody,
                    quickBooksResponse: {Customer:{error}}
                  };
                  if(isResponse == false)
                    return res.json(combinedResponse);
            } else {
                console.log(result.Customer.Id);
                quickbookAPIObj.updateCustomerQBID(req.session.loginId,req.session.customerId,result.Customer.Id)
                const combinedResponse = {
                  customerDetails: parsedBody,
                  quickBooksResponse: result
                };
                res.json(combinedResponse);
                addQuickBookLogs(loginId,"Quickbook Id updated in TopProz customer", "200" );
            }
          });
        };
      
      if(customerData.hasOwnProperty("quickBookId") && (customerData.quickBookId != "" || customerData.quickBookId != null))
      {
        quickbookAPIObj.getQBCustomer(req,customerData,req.session.realmId, (err, parsedBody) => {
          if (err) {
            if (err === 401) {
              response.statusCode = err;
              tools.checkForUnauthorized(req, { headers: { Authorization: `Bearer ${customerData.QBAccessToken}` } }, err, response)
              .then(() => {
                customerData.QBAccessToken = req.session.accessToken;
                //Update NewToken in TopProze DB
                saveQuickBookKeys(req.session.realmId,customerData.QBAccessToken,req.session.refreshToken,req.session.loginId, function (err, result) {
                  if (err) {
                    console.log('error: ' + err);
                    addQuickBookLogs(loginId,err, err.statusCode );
                  } else {
                    console.log('New Token Updated in TopProz while reading customer');
                    addQuickBookLogs(loginId,"New Access Token Updated in TopProz", result.statusCode );
                  }
                }); 
                quickbookAPIObj.getQBCustomer(req,customerData,req.session.realmId, (retryError, retryResult) => {
                  if (retryError) {
                    addQuickBookLogs(loginId,retryError, retryError.statusCode );
                    console.log("retryError: " + retryError.statusCode);
                    if(isResponse == false)                      
                      return res.json({'retryError: ': retryError});
                  }
                  else
                  {
                    if(retryError != null && (retryError.statusCode == 400 || retryError.statusCode == 404))
                    {
                      console.log("try adding customer");
                      delete customerData['SyncToken'];
                      tryAddingCustomer(customerData);
                    }
                    else {
                      customerData["SyncToken"] = retryResult.Customer.SyncToken;
                      console.log(retryResult.Customer.SyncToken);
                      tryAddingCustomer(customerData);
                    }
                  }

                });            
              })
              .catch(authError => {
                addQuickBookLogs(loginId,authError, authError.statusCode );
                  res.redirect('/home')
              });
          }else if(err == 400 || err == 404)
            {
              console.log("try adding customer");
              delete customerData['SyncToken'];
              tryAddingCustomer(customerData);
            } 
          else if (err) {
              addQuickBookLogs(loginId,err, err.statusCode );
            return console.log(err);
          }           
          } else {
              customerData["SyncToken"] = parsedBody.Customer.SyncToken;
              console.log(parsedBody.Customer.SyncToken);
              tryAddingCustomer(customerData);
          }
      });
      }
      else
        tryAddingCustomer(customerData);

      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        return res.status(500).json({ error: 'Error parsing response', details: parseError });
      }
    }
    });
  });

function saveQuickBookKeys(quickBookId, accessToken, refreshToken, loginId, callback) {
  const url = `${config.base_url}accountsetting/saveQuickBookKeys`;
  
  const options = {
    url: url,
    method: 'POST',
    headers: {
      'Authorization': config.topproz_token_id,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'loginId': loginId,
      'quickBookId': quickBookId,
      'accessToken': accessToken,
      'refreshToken': refreshToken
    })
  };
  
  request(options, function (err, response, body) {
    if (err || response.statusCode != 200) {
      return callback({error: err, statusCode: response.statusCode});
    } else {
      console.log('User Create successful');
      return callback(null, {response: "User Create successful"});
    }
  });
}

function addTopProzCustomer(resultBody) {
  const url = `${config.base_url}customer/addcustomer`;

  const options = {
    url: url,
    method: 'POST',
    headers: {
      'Authorization' : config.topproz_token_id,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
    "quickBookId": resultBody.Id, //Not Required
    "quickBookFullName": resultBody.FullyQualifiedName, //Not Required
    "loginId": req.session.loginId, 
    "customerEmailId": resultBody.PrimaryEmailAddr.Address,
    "phoneNumber": resultBody.PrimaryPhone.FreeFormNumber,    
    "customerType": "Residential",
    "dispatchTextNumber": resultBody.PrimaryPhone.FreeFormNumber,
    "vendor": "Quick Book",
    "source": "TV",
    "paymentMethod": "Cash",
    "creditLimit": 0,
    "paymentTerms": "Upon Receipt",
    "taxExempt": false,
    "poRequired": false,
    "doNotServe": false,
    "doNotServeNotes": "Text",
    "picturesAndVideos": [],    
    "firstName": resultBody.DisplayName,
    "lastName": "none",
    "userType": "Owner",
    "address": resultBody.BillAddr.Line1,
    "invoiceEmail": resultBody.PrimaryEmailAddr.Address,
    "city": resultBody.BillAddr.City,
    "state": resultBody.BillAddr.CountrySubDivisionCode,
    "zipCode": resultBody.BillAddr.PostalCode,
    "adminNotes": "Good Customer"
    })
  };
  
  request(options, function (err, response, body) {
    if (err || response.statusCode != 200) {
      {
        console.log("QB Customer is not adding in TopProz: " + response.statusCode);
        addQuickBookLogs(req.session.loginId,err, response.statusCode );
      }
    } else {
      let parseBody = JSON.parse(response.body);
      console.log('QB Customer has added successfull in TopProz ' + response.statusCode);
      addQuickBookLogs(req.session.loginId,'QB Customer has added successfull in TopProz', response.statusCode );
      
    }
  });
}

function addQuickBookLogs(loginId,message, status) {
  const url = `${config.base_url}quickBookLogs/addQuickBookLogs`;

  const options = {
    url: url,
    method: 'POST',
    headers: {
      'Authorization': config.topproz_token_id,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'loginId': loginId,
      'message': message,
      'status': status
    })
  };
  
  request(options, function (err, response, body) {
    if (err || response.statusCode != 200) {
      {
        console.log("Logs Inserted error: " + response.statusCode);
        return "error: " + err  + " | statusCode: " + response.statusCode;
      }
    } else {
      console.log('Logs inserted successful');
      return "Logs inserted successful";
    }
  });
}

function getTopProzNewToken(req,callback) {
  const url = `${config.base_url}auth/webLogin`;

  const options = {
    url: url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      'emailId': "yasser.abdelkader2020@gmail.com",
      'password': "Test&123",
      'role': "PRO"
    })
  };
  
  request(options, function (err, response, body) {
    if (err || response.statusCode != 200) {
      {
        console.log("Token is not Generating: " + response.statusCode);
        return callback("error: " + err  + " | statusCode: " + response.statusCode);
      }
    } else {
      let parseBody = JSON.parse(response.body);
      console.log('New Token Generated ' + response.statusCode);
      config.topproz_token_id = parseBody.data.token;
      return callback(parseBody.data.token);
    }
  });
}

module.exports = {router, saveQuickBookKeys, addQuickBookLogs, addTopProzCustomer};
