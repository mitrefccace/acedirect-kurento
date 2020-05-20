const express = require('express');
const debug   = require('debug')('ace:session-handler');
const param   = require('param');
const models  = require('./dal/models');

const router = express.Router();

router.get('/', async (req, res) => {
  if (param('kurento.monitoring_enabled')) {
    try {
      const sessions = await models.WebrtcSession.findAll();

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json(sessions);
    } catch (ex) {
      debug('Error on /session', ex.message);
      res.status(500).json({error: 'An error occurred'});
    }
  } else {
    res.status(404).send('Not found. Monitoring Disabled');
  }
});

router.get('/:id/stats', async (req, res) => {
  if (param('kurento.monitoring_enabled')) {
    try {
      const stats = await models.WebrtcStat.findAll({
        where: {
          session_id: req.params.id
        },
        order: [['timestamp', 'ASC']]
      });

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json(stats);
    } catch (ex) {
      debug('Error on /session/%s/stats', req.params.id, ex.message);
      res.status(500).json({error: 'An error occurred'});
    }
  } else {
    res.status(404).send('Not found. Monitoring Disabled');
  }
});

module.exports = router;