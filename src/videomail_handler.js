const express = require('express');
const debug   = require('debug')('ace:videomail-handler');
const models  = require('./dal/models');

const router = express.Router();

const RECORDS_PER_PAGE = 15;

router.get('/:peer', async (req, res) => {
  try {
    const { from, to, start = 0 } = req.query;
    const where = {
      peer: req.param('peer')
    };
    if(from && to) {
      where.created_at = { $between: [from, to]};
    }
    if(from) where.created_at = { $gt: from };
    if(to) where.created_at = { $lt: to };

    const mail = await models.VideoMail.findAll({
      where,
      offset: start,
      limit: RECORDS_PER_PAGE
    });

    res.json(mail);
  } catch (ex) {
    debug('Error on /videomail/:peer', ex.message);
    res.status(500).json({error: 'An error occurred'});
  }
});

module.exports = router;