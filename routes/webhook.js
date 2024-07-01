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

router.post('/', async function(req, res) {
    //await top_proz_api.LogsWrite("Webhook","Webhook Call Successful","1");
    var webhookPayload = JSON.stringify(req.body);
    //console.log(req.body);
    console.log('The paylopad is :' + JSON.stringify(req.body));
    //await top_proz_api.LogsWrite("Webhook",'The paylopad is : ' + JSON.stringify(req.body),"200");
    var signature = req.get('intuit-signature');
    var isTokenRefreshed = false;
    var fields = ['realmId', 'name', 'id', 'operation', 'lastUpdated'];
    var newLine= "\r\n";
  
    // if signature is empty return 401
    if (!signature) {
        return res.status(401).send('FORBIDDEN Signature is empty');
    }
  
    // if payload is empty, don't do anything
    if (!webhookPayload) {
        return res.status(200).send('success');
    }
  
    /**
     * Validates the payload with the intuit-signature hash
     */
    var hash = crypto.createHmac('sha256', config.webhooksVerifier).update(webhookPayload).digest('base64');
    //await top_proz_api.LogsWrite("Webhook","hash: " + hash + " | signature: " + signature,"0");
      console.log("Webhook","hash: " + hash + " | signature: " + signature)
    if (signature === hash) {      
        console.log("The Webhook notification payload is :" + webhookPayload);
        await top_proz_api.LogsWrite("Webhook","The Webhook notification payload is :" + webhookPayload,"200");
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
         quickbookAPIObj.getQBCustomer(req, notification, realmID, async (err, Result) => {
            console.log("webhook error geting customer: " + err)
              if (err) {
                  if (err.statusCode === 401 && isTokenRefreshed == false) {
                      let response = {statusCode : 401};  
                      tools.checkForUnauthorized(req, {url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', headers: { Authorization: `Bearer ${notification.QBAccessToken}` } }, err, response)
                      .then(async ({err, response}) => {
                        console.log('Token is refreshed..' )
                        await top_proz_api.LogsWrite("Webhook",'Token is refreshed..',"200");
                        top_proz_api.saveQuickBookKeys(realmID, response.newToken.accessToken, response.newToken.refreshToken, notification.loginId, async (err, result) => {
                            if (err) {
                                  console.log('error: ' + err);
                                  await top_proz_api.LogsWrite("Webhook",'error: ' + err,err.statusCode);
                              } else {
                                  console.log('New Token Updated in TopProz while reading customer from QB');
                                  await top_proz_api.LogsWrite("Webhook",'New Token Updated in TopProz while reading customer from QB',"200");
                                  isTokenRefreshed = true;
                                  notification["QBAccessToken"] = response.newToken.accessToken;
                                  quickbookAPIObj.getQBCustomer(req, notification, realmID, async (retryError, retryResult) => {
                                    if (retryError) {
                                        console.log("retryError: " + JSON.stringify(retryError));
                                        await top_proz_api.LogsWrite("Webhook",'error: ' + JSON.stringify(retryError),"400");
                                    } else {
                                        top_proz_api.getproCustomerByQbIDS(realmID,notification.quickBookId, async (error, result) => {
                                          if(error)
                                            top_proz_api.addTopProzCustomer(retryResult.Customer,notification.loginId);
                                          else
                                          {
                                            console.log('Customer already exists in TopProz')
                                            await top_proz_api.LogsWrite("Webhook",'Customer already exists in TopProz',"200");
                                            top_proz_api.updateTopProzCustomer(retryResult.Customer,notification.loginId);
                                          }
                                            
                                    });
                                        
                                    }
                                });
                              }
                          });  
                          
                      })
                      .catch(async authError => {
                          await top_proz_api.LogsWrite("Webhook", authError, authError.statusCode);
                          
                      });
                  } else {
                      await top_proz_api.LogsWrite("Webhook", err, err.statusCode);
                      console.log('Error: ' + err);
                  }
              } else {
                  top_proz_api.getproCustomerByQbIDS(realmID,notification.quickBookId, async (error, result) => {
                    if(error)
                      top_proz_api.addTopProzCustomer(Result.Customer,notification.loginId);
                    else
                    {
                      console.log('Customer already exists in TopProz')
                      await top_proz_api.LogsWrite("Webhook",'Customer already exists in TopProz',"200");
                      top_proz_api.updateTopProzCustomer(Result.Customer,notification.loginId);
                    }

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
          
          return;
        }

        top_proz_api.getQuickBookKeysByCompanyID(realmID,(Error, result) => {
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