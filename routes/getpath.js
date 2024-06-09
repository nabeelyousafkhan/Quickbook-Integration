const express = require('express');
const router = express.Router();

router.get('/getpath', function (req, res) {
    res.send('Hello world');
});

module.exports = router;
