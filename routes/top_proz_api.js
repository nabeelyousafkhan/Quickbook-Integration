const request = require('request');
const config = require('../config');
const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {

})

router.get('/getQuickBookKeysByLoginId/:loginId', function (req, res) {
const loginId = req.params.loginId;

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
      return res.status(400).json({ error: 'No record found' });
    }
    else{
    try {
      const parsedBody = JSON.parse(body);
      const quickBookId = parsedBody.data.quickBook.quickBookId;
      const accessToken = parsedBody.data.quickBook.accessToken;
      const refreshToken = parsedBody.data.quickBook.refreshToken;
      req.session.loginId = loginId;
      // Process the tokens as needed, or send them in the response
      res.json({
        quickBookId,
        accessToken,
        refreshToken
      });
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      return res.status(500).json({ error: 'Error parsing response', details: parseError });
    }
  }
  });
});

router.get('/proCustomerDetails/:customerId', function (req, res) {
  const loginId = req.session.loginId;  
  const customerId = req.params.customerId;  
    request({
      url: `${config.base_url}proCustomer/proCustomerDetails/${loginId}/${customerId}`,
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
        return res.status(400).json({ error: 'No record found' });
      }
      else{
      try {
        const parsedBody = JSON.parse(body);
        res.json({parsedBody});

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

module.exports = {router, saveQuickBookKeys};
