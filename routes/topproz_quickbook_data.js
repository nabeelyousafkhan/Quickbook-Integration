const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
  res.render('topproz_quickbook_data'); 
});

module.exports = router;