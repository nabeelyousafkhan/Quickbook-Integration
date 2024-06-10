var tools = require('../tools/tools.js')
var jwt = require('../tools/jwt.js')
var express = require('express')
var router = express.Router()
var top_proz_api = require('../routes/top_proz_api.js')

/** /callback **/
router.get('/', function (req, res) {
  // Verify anti-forgery
  if(!tools.verifyAntiForgery(req.session, req.query.state)) {
    return res.send('Error - invalid anti-forgery CSRF response!')
  }


  // Exchange auth code for access token
  tools.intuitAuth.code.getToken(req.originalUrl).then(function (token) {
    // Store token - this would be where tokens would need to be
    // persisted (in a SQL DB, for example).
    tools.saveToken(req.session, token)
    req.session.realmId = req.query.realmId
    console.log(req.session.realmId);
    top_proz_api.saveQuickBookKeys(req.session.realmId,token.accessToken,token.refreshToken,req.session.loginId, function (err, result) {
      if (err) {
        console.log('error: ' + err);
        //return res.status(500).json({ error: 'Error saving QuickBook keys', details: err });
      } else {
        console.log('Added Successfully');
        //return res.json(result);
      }
    });
    
    var errorFn = function(e) {
      console.log('Invalid JWT token!')
      console.log(e)
      res.redirect('/')
    }

    if(token.data.id_token) {
      try {
        // We should decode and validate the ID token
        jwt.validate(token.data.id_token, function() {
          // Callback function - redirect to /connected
          res.redirect('topproz_quickbook_data')
        }, errorFn)
      } catch (e) {
        errorFn(e)
      }
    } else {
      // Redirect to /connected
      res.redirect('topproz_quickbook_data')
    }
  }, function (err) {
    console.log(err)
    res.send(err)
  })
})

module.exports = router
