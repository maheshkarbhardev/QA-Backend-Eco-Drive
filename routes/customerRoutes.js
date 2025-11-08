const express=require("express");
const router=express.Router();
const customerController=require('../controllers/customerController');

router.get('/getAllCustomers',customerController.getAllCustomers)

module.exports=router;