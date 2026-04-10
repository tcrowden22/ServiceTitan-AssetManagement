module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: true // Allow null for SAML users
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'user' // 'admin', 'user'
    },
    authProvider: {
      type: DataTypes.STRING,
      defaultValue: 'local', // 'local', 'saml'
      allowNull: false
    }
  });

  return User;
};


