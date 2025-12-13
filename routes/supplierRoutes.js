const express=require('express');
const router=express.Router();
const supplierController=require('../controllers/supplierController');

router.get('/getAllSuppliers',supplierController.getAllSuppliers);

module.exports=router;