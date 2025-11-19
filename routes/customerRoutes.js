const express=require("express");
const router=express.Router();
const customerController=require('../controllers/customerController');
const { uploadGstImages } = require("../controllers/customerController"); //import upload image middleware

router.get('/getAllCustomers',customerController.getAllCustomers);
router.get('/states',customerController.getStates);
router.get('/districts/:state_id',customerController.getDistricts);
router.get('/talukas/:district_id',customerController.getTaluka);
router.get('/cities/:taluka_id',customerController.getCities)
router.post('/addCustomer',uploadGstImages,customerController.addCustomer)

module.exports=router;