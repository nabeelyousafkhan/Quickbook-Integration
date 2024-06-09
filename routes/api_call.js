var tools = require('../tools/tools.js')
var config = require('../config.json')
var request = require('request')
var express = require('express')
var router = express.Router()

/** /api_call **/
router.get('/', function (req, res) {
  var token = tools.getToken(req.session)
  if(!token) return res.json({error: 'Not authorized'})
  if(!req.session.realmId) return res.json({
    error: 'No realm ID.  QBO calls only work if the accounting scope was passed!'
  })

  // Set up API call (with OAuth2 accessToken)
  //var url = config.api_uri + req.session.realmId + '/companyinfo/' + req.session.realmId
  var url = config.api_uri + req.session.realmId + '/query?query=select * from Customer Where Metadata.LastUpdatedTime > \'2015-03-01\''
  console.log('Making API call to: ' + url)
  var requestObj = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + token.accessToken,
      'Accept': 'application/json'
    }
  }

  // Make API call
  request(requestObj, function (err, response) {
    // Check if 401 response was returned - refresh tokens if so!
    tools.checkForUnauthorized(req, requestObj, err, response).then(function ({err, response}) {
      if(err || response.statusCode != 200) {
        return res.json({error: err, statusCode: response.statusCode})
      }

      // API Call was a success!
      res.json(JSON.parse(response.body))
    }, function (err) {
      console.log(err)
      return res.json(err)
    })
  })
})

/** /api_call/revoke **/
router.get('/revoke', function (req, res) {
  var token = tools.getToken(req.session)
  if(!token) return res.json({error: 'Not authorized'})

  var url = tools.revoke_uri
  request({
    url: url,
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + tools.basicAuth,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'token': token.accessToken
    })
  }, function (err, response, body) {
    if(err || response.statusCode != 200) {
      return res.json({error: err, statusCode: response.statusCode})
    }
    tools.clearToken(req.session)
    res.json({response: "Revoke successful"})
  })
})

/** /api_call/refresh **/
// Note: typical use case would be to refresh the tokens internally (not an API call)
// We recommend refreshing upon receiving a 401 Unauthorized response from Intuit.
// A working example of this can be seen above: `/api_call`
router.get('/refresh', function (req, res) {
  var token = tools.getToken(req.session)
  if(!token) return res.json({error: 'Not authorized'})

  tools.refreshTokens(req.session).then(function(newToken) {
    // We have new tokens!
    res.json({
      accessToken: newToken.accessToken,
      refreshToken: newToken.refreshToken
    })
  }, function(err) {
    // Did we try to call refresh on an old token?
    console.log(err)
    res.json(err)
  })
})

router.get('/aagetAcceToken/:loginId', function (req, res) {
  const loginId = req.params.loginId;
  request({
    url: `${config.base_url}accountsetting/getQuickBookKeysByLoginId/${loginId}`,
    method: 'GET',
    headers: {
      'Authorization': config.token_id
    },
  }, function (err, response,body) {
  if (err) {
      console.error('Request error:', err);
      return res.status(500).json({ error: 'Internal server error', details: err });
  }

  if (!response) {
      console.error('No response received');
      return res.status(500).json({ error: 'No response received from server' });
  }

    if(response.statusCode != 200) {
        console.log('id not found');
        res.redirect('/home'); 
        //res.status(response.statusCode).json({error: 'Error retrieving access token', details: body })
    }
    else
    {
    try {
      const parsedBody = JSON.parse(body);
        const quickBookId = parsedBody.data.quickBook.quickBookId;
        const accessToken = parsedBody.data.quickBook.accessToken;
        const refreshToken = parsedBody.data.quickBook.refreshToken;
        console.log(quickBookId);
  } catch (parseError) {
      console.error('Error parsing response:', parseError);
      res.status(500).json({ error: 'Error parsing response', details: parseError });
  }
   }

  })
})

module.exports = router
