const request = require('request');
const config = require('../config');
const express = require('express');
const router = express.Router();

router.get('/getqbdata/:loginId', function (req, res) {
const loginId = req.params.loginId;
  request({
    url: `${config.base_url}accountsetting/getQuickBookKeysByLoginId/${loginId}`,
    method: 'GET',
    headers: {
      'Authorization': config.token_id
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
      console.log(response.statusCode + ' no result found ');
      res.statusCode = response.statusCode;
    }
    else{
    try {
      const parsedBody = JSON.parse(body);
      const quickBookId = parsedBody.data.quickBook.quickBookId;
      const accessToken = parsedBody.data.quickBook.accessToken;
      const refreshToken = parsedBody.data.quickBook.refreshToken;
      console.log(quickBookId);
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

module.exports = router;
