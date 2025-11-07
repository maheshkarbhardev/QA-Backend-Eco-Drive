const express=require('express');
const router=express.Router();
const productController=require('../controllers/productController');

router.get('/getAllProducts',productController.getProducts);
router.get('/getCategories',productController.getCategories);
router.get('/getUsageUnits',productController.getUsageUnits);
router.get('/getProductById/:id', productController.getProductById); 
router.post('/addProduct',productController.uploadProductImage,productController.addProduct);
router.put('/updateProduct/:id',productController.uploadProductImage,productController.updateProduct);
router.delete('/deleteProduct/:id',productController.deleteProduct);

module.exports=router;