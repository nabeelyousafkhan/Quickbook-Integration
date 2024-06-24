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
        var myaccessToken = "eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..pIecVdLpLLBkhIdKKr-5Ag.Hb_Q4b4gyQPQimwrcFBnxXrHV5RGFLUHaeeBwezGM06pc69QZsJzNtlX-Vawjm2efoOMvtyRat3WrDclN51IIpEEmukK_SjhFokPqxzqRarBJl_j_s2ZYit1jW-pT__OrVN8l9pVCSCtLj7cNgMYpGxjzJkCT5cg0FHY5-V0SlPohCalgBJ3Htonhg5gfT0OuiF752GvY5gkKghD50OeMxhh4ZvI-39pf53nwGKXEThXpuGByvTYcRNOyfsGrS4vjKeHOICcZ9Cbx0ACvYHmhDJlA256ayaFV864m4O32Qvt53JT6oMiVrDlalVj05V2j6rsRIqS696v2westjFUrB4oUmVZNXw1Gx5mM5SpbeaS5Jb9-wq_ic_EQiU2ZFWcGRhRObkgnnG8Gh4f-7fWHiLjOhdQFO197sDEcJpILSfdJDSyigzwWOwkITSAR1vxGS4ApSPFgy6dpb-HBvKWLiKnWknvX2Q6FTfb8EH3PbZTgKHG2vnaeRdXPMaKSHYSG0xzGkx4DhHhMrQiX3xYqiFZ2kOqnwRGAiam9ZGWP3x6SES0AxLnY-LS4gCoOSvt6zEMEQgSrbxOsC1kQENXNzRJGPk0eH2me5mWA9rXMWG_kyrcsEJYGf_fdo_FXrkhbZNmSUig017q1euccjUhUmmZjV1qMwkBTDGjXf2rWiPoTZFc7PoCIb7lfflxnQC9JQecl-oGiif31iZrleF_GYTDbnwMbXylMuPYL6J-5TQ.xAzo8xQs_CPX0fWXb0MfvQ";
        var loginId = "64775f67053e90d344453a74";
        var appendThis = [];
          for(var i=0; i < req.body.eventNotifications.length; i++) {
              var entities = req.body.eventNotifications[i].dataChangeEvent.entities;
              var realmID = req.body.eventNotifications[i].realmId;
              for(var j=0; j < entities.length; j++) {
                  var notification = {
                      'realmId': realmID,
                      'name': entities[i].name,
                      'quickBookId': entities[i].id,
                      'operation': entities[i].operation,
                      'lastUpdated': entities[i].lastUpdated,
                      'QBAccessToken' : myaccessToken
                  }
                  appendThis.push(notification);
                  
                  if(notification.name == 'Customer')
                  {
                 
                  quickbookAPIObj.getQBCustomer(req,notification,realmID, (err, Result) => {
                    if (err) {
                        if (err === 401) {                          
                          tools.checkForUnauthorized(req, { headers: { Authorization: `Bearer ${myaccessToken}` } }, err, 401)
                          .then(() => {
                            //Update NewToken in TopProze DB
                            saveQuickBookKeys(realmID,req.session.accessToken,myaccessToken,loginId, function (err, result) {
                              if (err) {
                                console.log('error: ' + err);
                                top_proz_api.addQuickBookLogs(loginId,err, err.statusCode );
                              } else {
                                console.log('New Token Updated in TopProz while reading customer from QB');
                                top_proz_api.addQuickBookLogs(loginId,"New Access Token Updated in TopProz", result.statusCode );
                              }
                            }); 
                            quickbookAPIObj.getQBCustomer(req,notification,realmID, (retryError, retryResult) => {
                              if (retryError) {
                                addQuickBookLogs(loginId,retryError, retryError.statusCode );
                                console.log("retryError: " + retryError.statusCode);
                                top_proz_api.addQuickBookLogs(loginId,retryError, retryError.statusCode );
                              }
                              else
                              {
                                const parsedBody = JSON.parse(retryResult);
                                console.log(parsedBody);
                                top_proz_api.addTopProzCustomer(parsedBody);
                              }
            
                            });            
                          })
                          .catch(authError => {
                            top_proz_api.addQuickBookLogs(loginId,authError, authError.statusCode );
                              res.redirect('/home')
                          });
                      }
                      else if (err) {
                        top_proz_api.addQuickBookLogs(loginId,err, err.statusCode );
                        return console.log('Error: ' + err);
                      }           
                      }
                    else
                    {
                        //const parsedBody = JSON.parse(Result);
                        console.log(Result);
                        //top_proz_api.addTopProzCustomer(parsedBody);
                    }
  
                  });
                }
              }
          }
  
          console.log(appendThis);
  
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