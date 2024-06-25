const config = require('../config');
var express = require('express')
var router = express.Router()
var crypto = require('crypto');
var bodyParser = require('body-parser')
var top_proz_api = require('../routes/top_proz_api.js')
const quickbookAPIObj = require('../routes/quickbook_api_call')
var tools = require('../tools/tools.js')

router.use(bodyParser.json())
var urlencodedParser = bodyParser.urlencoded({ extended: false })

router.get('/', function(req, res) {
    
})

router.post('/', function(req, res) {
    var webhookPayload = JSON.stringify(req.body);
    //console.log(req.body);
    console.log('The paylopad is :' + JSON.stringify(req.body));
    var signature = req.get('intuit-signature');
    var isTokenRefreshed = false;
    var fields = ['realmId', 'name', 'id', 'operation', 'lastUpdated'];
    var newLine= "\r\n";
  
    // if signature is empty return 401
    if (!signature) {
        return res.status(401).send('FORBIDDEN');
    }
  
    // if payload is empty, don't do anything
    if (!webhookPayload) {
        return res.status(200).send('success');
    }
  
    /**
     * Validates the payload with the intuit-signature hash
     */
    var hash = crypto.createHmac('sha256', config.webhooksVerifier).update(webhookPayload).digest('base64');
    if (signature === hash) {      
        console.log("The Webhook notification payload is :" + webhookPayload);        
        const processedRealmIDs = new Set();

        const processCustomer = (notification, realmID) => {
          res=null;
          req.session = {
            accessToken: notification.QBAccessToken,
            realmID: realmID,
            refreshToken: notification.refreshToken,
            refreshToken: notification.refreshToken,
            loginId: notification.loginId
        };
          quickbookAPIObj.getQBCustomer(req, notification, realmID, (err, Result) => {
              if (err) {
                  if (err.statusCode === 401 && isTokenRefreshed == false) {
                      let response = {statusCode : 401};  
                      tools.checkForUnauthorized(req, {url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', headers: { Authorization: `Bearer ${notification.QBAccessToken}` } }, err, response)
                      .then(({err, response}) => {
                        console.log('Token is refreshed..' )
                        top_proz_api.saveQuickBookKeys(realmID, response.newToken.accessToken, response.newToken.refreshToken, notification.loginId, (err, result) => {
                            if (err) {
                                  console.log('error: ' + err);
                                  top_proz_api.addQuickBookLogs(notification.loginId, err, err.statusCode);
                              } else {
                                  console.log('New Token Updated in TopProz while reading customer from QB');
                                  top_proz_api.addQuickBookLogs(notification.loginId, "New Access Token Updated in TopProz", result.statusCode);
                                  isTokenRefreshed = true;
                                  notification["QBAccessToken"] = response.newToken.accessToken;
                                  quickbookAPIObj.getQBCustomer(req, notification, realmID, (retryError, retryResult) => {
                                    if (retryError) {
                                        console.log("retryError: " + JSON.stringify(retryError));
                                        top_proz_api.addQuickBookLogs(notification.loginId, retryError, retryError.statusCode);
                                    } else {
                                        top_proz_api.getproCustomerByQbIDS(null,null,realmID,notification.quickBookId, (error, result) => {
                                          if(error)
                                            top_proz_api.addTopProzCustomer(retryResult.Customer,notification.loginId);
                                          else
                                            console.log('Customer already exists in TopProz')

                                    });
                                        
                                    }
                                });
                              }
                          });  
                          
                      })
                      .catch(authError => {
                          top_proz_api.addQuickBookLogs(notification.loginId, authError, authError.statusCode);
                          
                      });
                  } else {
                      top_proz_api.addQuickBookLogs(notification.loginId, err, err.statusCode);
                      console.log('Error: ' + err);
                  }
              } else {
                  top_proz_api.getproCustomerByQbIDS(null,null,realmID,notification.quickBookId, (error, result) => {
                    if(error)
                      top_proz_api.addTopProzCustomer(Result.Customer,notification.loginId);
                    else
                      console.log('Customer already exists in TopProz')
                  });
                  
              }
          });
      };
      
      req.body.eventNotifications.forEach(notification => {
        const entities = notification.dataChangeEvent.entities;
        const realmID = notification.realmId;
        let accessToken = "";
        let loginId = "";
        let refreshToken = "";

        if (processedRealmIDs.has(realmID)) {
          // If the realmID has already been processed, skip to the next notification
          return;
        }
        processedRealmIDs.add(realmID);

        top_proz_api.getQuickBookKeysByCompanyID(null,null,realmID,(Error, result) => {
          if (Error) {
            console.log("Error: " + Error);
          }
          else
          {
            accessToken = result.data.quickBook.accessToken;
            loginId = result.data.loginId;
            refreshToken = result.data.quickBook.refreshToken;

            entities.forEach(entity => {
              var entityNotification = {
                  'realmId': realmID,
                  'name': entity.name,
                  'quickBookId': entity.id,
                  'operation': entity.operation,
                  'lastUpdated': entity.lastUpdated,
                  'QBAccessToken': accessToken,
                  'refreshToken' : refreshToken,
                  'loginId' : loginId
              };
  
              //console.log(entityNotification);  
              if (entityNotification.name === 'Customer') {              
                  processCustomer(entityNotification, realmID);
              }
          });
          }
        })   
        
      }); 
       return res.status(200).send('SUCCESS');  
    }
    else
    {
      console.log("hash:" + hash);
      console.log("intuit-signature not matched :" + signature);
    }
  
    return res.status(401).send('FORBIDDEN');
  });

  module.exports = router