const express = require('express');
const debug   = require('debug')('ace:recording-handler');
const RecMan  = require('./rec_manager');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const recordings = await RecMan.listRecordings({
      peer: req.query['peer'],
      session_id: req.query['session'],
      date_interval: { from: req.query['from'], to: req.query['to'] }
    });

    res.json(recordings);
  } catch (ex) {
    debug('Error on /recording/', ex.message);
    res.status(500).json({error: 'An error occurred'});
  }
});

module.exports = router;