var path = require('path')
var config = require('./config.json')
var express = require('express')
var session = require('cookie-session')
var app = express()
var crypto = require('crypto');

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({secret: 'secret', resave: 'false', saveUninitialized: 'false'}))

// Initial view - loads Connect To QuickBooks Button
app.get('/', function (req, res) {
  res.render('login', config)
})

// Sign In With Intuit, Connect To QuickBooks, or Get App Now
// These calls will redirect to Intuit's authorization flow
app.use('/sign_in_with_intuit', require('./routes/sign_in_with_intuit.js'))
app.use('/connect_to_quickbooks', require('./routes/connect_to_quickbooks.js'))
app.use('/connect_handler', require('./routes/connect_handler.js'))

// Callback - called via redirect_uri after authorization
app.use('/callback', require('./routes/callback.js'))

// Connected - call OpenID and render connected view
app.use('/connected', require('./routes/connected.js'))

// Call an example API over OAuth2
app.use('/api_call', require('./routes/api_call.js'))

app.use('/home', require('./routes/home.js'));
app.use('/top_proz_api', require('./routes/top_proz_api.js').router);
app.use('/quickbook_api_call', require('./routes/quickbook_api_call.js').router);
app.use('/topproz_quickbook_data', require('./routes/topproz_quickbook_data.js'));
app.use('/webhook', require('./routes/webhook.js'));

// app.post('/webhook', function(req, res) {

//     var webhookPayload = JSON.stringify(req.body);
//     //console.log(req.body);
//     console.log('The paylopad is :' + JSON.stringify(req.body));
//     var signature = req.get('intuit-signature');
  
//     var fields = ['realmId', 'name', 'id', 'operation', 'lastUpdated'];
//     var newLine= "\r\n";
  
//     // if signature is empty return 401
//     if (!signature) {
//         return res.status(401).send('FORBIDDEN');
//     }
  
//     // if payload is empty, don't do anything
//     if (!webhookPayload) {
//         return res.status(200).send('success');
//     }
  
//     /**
//      * Validates the payload with the intuit-signature hash
//      */
//     var hash = crypto.createHmac('sha256', config.webhooksVerifier).update(webhookPayload).digest('base64');
//     if (signature === hash) {
//         console.log("The Webhook notification payload is :" + webhookPayload);
  
//         var appendThis = [];
//           for(var i=0; i < req.body.eventNotifications.length; i++) {
//               var entities = req.body.eventNotifications[i].dataChangeEvent.entities;
//               var realmID = req.body.eventNotifications[i].realmId;
//               for(var j=0; j < entities.length; j++) {
//                   var notification = {
//                       'realmId': realmID,
//                       'name': entities[i].name,
//                       'id': entities[i].id,
//                       'operation': entities[i].operation,
//                       'lastUpdated': entities[i].lastUpdated
//                   }
//                   appendThis.push(notification);
//               }
//           }
  
//           console.log(appendThis);
  
//         return res.status(200).send('SUCCESS');
//     }
//     else
//     {
//       console.log("hash:" + config.webhooksVerifier);
//       console.log("intuit-signature not matched :" + signature);
//     }
  
//     return res.status(401).send('FORBIDDEN');
//   });
// Start server on HTTP (will use ngrok for HTTPS forwarding)
app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})

module.exports = app;