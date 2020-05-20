'use strict';
module.exports = (sequelize, DataTypes) => {
  const VideoMail = sequelize.define('VideoMail', {
    peer: DataTypes.STRING,
    created_at: {
      type: DataTypes.INTEGER,
      defaultValue: sequelize.fn('NOW')
    },
    filename: DataTypes.STRING
  }, {
    underscored: true,
    tableName: 'ace_direct_video_mail',
    timestamps: false
  });
  return VideoMail;
};