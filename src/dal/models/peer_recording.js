'use strict';
module.exports = (sequelize, DataTypes) => {
  const PeerRecording = sequelize.define('PeerRecording', {
    session_id: DataTypes.UUID,
    peer: DataTypes.STRING,
    filename: DataTypes.STRING,
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.fn('NOW')
    }
  }, {
    underscored: true,
    tableName: 'ace_direct_peer_recording',
    timestamps: false
  });
  return PeerRecording;
};