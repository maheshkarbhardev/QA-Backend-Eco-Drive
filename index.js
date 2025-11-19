const express = require("express");  //import express library
const app = express(); // create express server
const cors = require("cors");  //import cors library
const dotenv = require("dotenv"); //import dotenv library 
  
const path = require("path");

dotenv.config();
const db = require("./config/db");
 // import routes 
const authRoutes = require("./routes/authRoutes");  //import authentication routing for signup and signin .
const productRoutes=require("./routes/productRoutes");
const customerRoutes=require('./routes/customerRoutes');

app.use(cors()); //use cors middleware
app.use(express.json());
// parse URL-encoded bodies (for non-multipart forms) — safe to include
app.use(express.urlencoded({ extended: true }));

// expose uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


//routes middleware
app.use("/api/auth", authRoutes); 
app.use("/api/product",productRoutes);
app.use("/api/customer",customerRoutes);
const PORT = process.env.PORT || 3000;

//to start the server
app.listen(PORT, () => {
  console.log(`Backend Server is Runinng At PORT: ${PORT}`);
});
