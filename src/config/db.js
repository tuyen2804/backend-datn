const mysql = require("mysql2");
const dotenv = require("dotenv");

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,       
    password: process.env.DB_PASS,   
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if(err){
        console.error("MySQL connection error:", err);
    } else {
        console.log("✅ MySQL connected successfully");
        connection.release();
    }
});

module.exports = pool.promise(); // dùng promise để dễ await query
