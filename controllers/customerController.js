const db = require("../config/db");

const getAllCustomers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,name,mobile,email,status FROM customers ORDER BY id desc`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.log("getAllCustomers API error:- ",error);
    res.status(500).json({success:false,message:"Internal Server Error"})
  }
};

module.exports={getAllCustomers}