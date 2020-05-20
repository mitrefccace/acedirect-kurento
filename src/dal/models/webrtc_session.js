'use strict';
module.exports = (sequelize, DataTypes) => {
  const WebrtcSession = sequelize.define('WebrtcSession', {
    session_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    from: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    to: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.fn('NOW'),
      allowNull: false
    }
  }, {
    underscored: true,
    tableName: 'ace_direct_webrtc_session',
    timestamps: false
  });
  return WebrtcSession;
};