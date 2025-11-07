const mysql=require('mysql2');  //import mysql package
const dotenv=require('dotenv'); //import dotenv package
dotenv.config();

//to make connection between mysql database and backend
const connection=mysql.createPool({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME
}).promise();

module.exports=connection;