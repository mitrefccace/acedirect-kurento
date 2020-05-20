'use strict';
module.exports = (sequelize, DataTypes) => {
  const VALID_STAT_KEYS = [
    'bytesReceived',
    'firCount',
    'fractionLost',
    'jitter',
    'nackCount',
    'packetsLost',
    'packetsReceived',
    'pliCount',
    'remb',
    'sliCount',
    'roundTripTime'
  ];
  const WebrtcStat = sequelize.define('WebrtcStat', {
    session_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    peer: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    timestamp: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    stat: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    value: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false
    }
  }, {
    underscored: true,
    tableName: 'ace_direct_webrtc_session_stat',
    timestamps: false
  });

  WebrtcStat.persistStats = async (session, media, peer, epStats) => {
    const data = [];
    for (const endpoint in epStats) {
      const stats = epStats[endpoint];
      if (stats.type === 'inboundrtp' || stats.type === 'outboundrtp') {
        const timestamp = stats.timestamp;
        for (const key of VALID_STAT_KEYS) {
          if (stats[key] !== undefined) {
            data.push({
              stat: `${stats.type}.${media}.${key}`,
              session_id: session,
              peer,
              value: stats[key],
              timestamp
            });
          }
        }
      }
    }
    return WebrtcStat.bulkCreate(data);
  };

  return WebrtcStat;
};