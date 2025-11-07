const express=require('express'); //import express library
const router=express.Router(); //create Router 
const authController=require('../controllers/authController'); //import authController API file

router.post("/signup",authController.signUp); //signup post api routing.
router.post("/signin",authController.signIn); //signin post api routing.

module.exports=router;