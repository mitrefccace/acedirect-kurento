'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('ace_direct_webrtc_session_stat', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      session_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      peer: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      timestamp: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      stat: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      value: {
        type: Sequelize.DECIMAL(15, 5),
        allowNull: false
      },
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('ace_direct_webrtc_session_stat');
  }
};
