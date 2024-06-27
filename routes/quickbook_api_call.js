const https = require('https');
const request = require('request');
const config = require('../config');
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
var top_proz_api = require('../routes/top_proz_api.js')
let myTopProzeToken = "";

router.get('/', function (req, res) {
  
})

function addCustomerToQuickBooks(customerData, callback) {
    const CompanyID = customerData.CompanyID;  
    const url = `${config.api_uri}${CompanyID}/customer`;

    var jsonBody = {};
    if(customerData.hasOwnProperty("quickBookId") && customerData.hasOwnProperty("SyncToken") && (customerData.quickBookId != "" || customerData.quickBookId != null))
    {
      jsonBody =  {
        "FullyQualifiedName": customerData.FullyQualifiedName,
        "PrimaryEmailAddr": {
          "Address": customerData.EmailAddress
        },
        "DisplayName": customerData.FullyQualifiedName,
        "Suffix": "",
        "Title": "",
        "MiddleName": "",
        "Notes": "",
        "FamilyName": "",
        "PrimaryPhone": {
          "FreeFormNumber": customerData.FreeFormNumber
        },
        "CompanyName": "",
        "BillAddr": {
          "CountrySubDivisionCode": customerData.CountrySubDivisionCode,
          "City": customerData.City,
          "PostalCode": customerData.PostalCode,
          "Line1": customerData.address,
          "Country": ""
        },
        "GivenName": customerData.FullyQualifiedName,
        "Id": customerData.quickBookId,
        "SyncToken": customerData.SyncToken
      }
    }
    else
    {
      jsonBody =  {
        "FullyQualifiedName": customerData.FullyQualifiedName,
        "PrimaryEmailAddr": {
          "Address": customerData.EmailAddress
        },
        "DisplayName": customerData.FullyQualifiedName,
        "Suffix": "",
        "Title": "",
        "MiddleName": "",
        "Notes": "",
        "FamilyName": "",
        "PrimaryPhone": {
          "FreeFormNumber": customerData.FreeFormNumber
        },
        "CompanyName": "",
        "BillAddr": {
          "CountrySubDivisionCode": customerData.CountrySubDivisionCode,
          "City": customerData.City,
          "PostalCode": customerData.PostalCode,
          "Line1": customerData.address,
          "Country": ""
        },
        "GivenName": customerData.FullyQualifiedName
      }
    }
    
    const options = {
      url: url,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerData.QBAccessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      json: jsonBody
    };
    
    request(options, function(err, response, body) {
      if (err) {
        console.error('Request error:', err);
        return callback({ error: 'Internal server error', details: err });
      }
    
      if (response.statusCode !== 200) {
        console.log(response.statusCode + ' no record found qb');
        return callback({ error: JSON.stringify(response), statusCode: response.statusCode });
      }
    
      try {
        //console.log(body);
        callback(null, body);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        return callback({ error: 'Error parsing response', details: parseError });
      }
    });
  }

  function updateCustomerQBID(loginId,customerId,quickBookId) {
    fs.readFile('data.json', 'utf8')
  .then(data => {    
    const parsedObject = JSON.parse(data);
    myTopProzeToken = parsedObject.topproz_token_id;
  })

    const url = `${config.base_url}proCustomer/updateCustomerQBID`;    
    const options = {
      url: url,
      method: 'PUT',
      headers: {
        'Authorization': myTopProzeToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        'loginId': loginId,
        'customerId': customerId,
        'quickBookId': quickBookId
      })
    };
    
    request(options, function (err, response, body) {
      if (err || response.statusCode != 200) {
        console.log(err + " - statusCode: " +  response.statusCode);
        return {error: err, statusCode: response.statusCode};
      } else {
        console.log('Update quickBookId successful');
        return response + " - Update quickBookId successful";
      }
    });
  }
  
 function getQBCustomer(req, customerData,CompanyID,callback) {
    
      request({
        url: `${config.api_uri}${CompanyID}/customer/${customerData.quickBookId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${customerData.QBAccessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      }, function (err, response, body) {
        if (err) {
          console.error('Request error:', err);
          return callback(err + ' - 500 Internal server error',null) ;
        }
    
        if (!response) {
          console.error('No response received');
          callback(err + ' 500 No response received from server', null);
          return;
        }
    
        if (response.statusCode !== 200) {
          console.log(response.statusCode + ' no record found ');
          err = response;
          return callback(err, null);
        }
        else{
        try {
          console.log('QB Customer get Successfully')
          const parsedBody = JSON.parse(body);
          callback(null,parsedBody); 

        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          callback('500 Error parsing response - details: ' + parseError, null);
        }
      }
      });
    }
  
  module.exports = {router, addCustomerToQuickBooks, updateCustomerQBID,getQBCustomer};