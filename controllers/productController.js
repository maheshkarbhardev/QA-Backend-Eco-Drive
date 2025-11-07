const db = require("../config/db");
const multer=require("multer");
const path=require("path");
const fs=require("fs");

//multer configurations
//before staring this, ensures that uploads folder should have created in backend.

const uploadDir=path.join(__dirname,"../uploads");
if(!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir);
}

//setup storage for image uploading.
const storage=multer.diskStorage({
  destination:function(req,file,cb){
    cb(null,uploadDir);
  },
  filename:function(req,file,cb){
    const uniqueSuffix=Date.now() + path.extname(file.originalname);
    cb(null,file.fieldname+"-"+uniqueSuffix);
  },
})

//file type filter (only images can upload)
const fileFilter=(req,file,cb)=>{
  const allowedType=/jpeg|jpg|png|webp/;
  const extname=allowedType.test(path.extname(file.originalname).toLowerCase());

  const mimetype=allowedType.test(file.mimetype);

  if(extname && mimetype){
    cb(null,true)
  }else{
    cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"));
  }
}

const upload=multer({
  storage,
  limits:{ fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter
});

const uploadProductImage = upload.single("image");


//Get all products
const getProducts = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id,p.name,p.hsn,p.status,p.created_at,pc.name as category,pu.name as usage_unit FROM products p LEFT JOIN product_categories pc ON p.category_id =pc.id LEFT JOIN product_usage_unit pu ON p.usage_unit_id = pu.id ORDER BY p.id DESC`
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


//get api for categories
const getCategories=async(req,res)=>{
  try {
    const [rows]=await db.query(`SELECT id,name FROM product_categories WHERE status = 1 ORDER BY name ASC`);
    res.status(200).json({success:true,data:rows});

  } catch (error) {
    console.log("Error in getCategories API:- ",error);
    res.status(500).json({success:false,message:"Internal Server Error"})
  }
};

//get api for getUsageUnits
const getUsageUnits =async(req,res)=>{
  try {
    const [rows]= await db.query(`SELECT id,name FROM product_usage_unit WHERE status=1 ORDER BY name ASC`);

    res.status(200).json({success:true,data:rows})
  } catch (error) {
    console.log("Error fetching usage units:", error);
    res.status(500).json({success:false,message:"Internal Server Error"})
  }
};

const addProduct=async(req,res)=>{
  try {
    const {name,description,category_id,hsn,gst,usage_unit_id,inventory,status}=req.body;
    //uploaded image
    const image =req.file ? req.file.filename : "";

    //validation
    if (!name || !category_id || !hsn || !usage_unit_id) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const created_at =new Date();
    const updated_at =new Date();

    const [result]=await db.query(`INSERT INTO products
      (name, description, category_id, image, hsn, igst, cgst, sgst, usage_unit_id, status, created_at, updated_at, inventory)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description || "",
        category_id,
        image,
        hsn,
        gst || 0,
        gst / 2 || 0, // cgst
        gst / 2 || 0, // sgst
        usage_unit_id,
        status,
        created_at,
        updated_at,
        inventory
      ]);

      res.status(201).json({
        success:true,
        message:"Product Added Successfully.",
        productId:result.insertId
      });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

const updateProduct=async(req,res)=>{
  try {
    const {id}=req.params;
    const {name, description, category_id, hsn, gst, usage_unit_id, inventory, status}=req.body;

    const image=req.file ? req.file.filename : null;

    //check if product is exists?
    const [existingProduct]=await db.query(`SELECT * FROM products WHERE id = ?`,[id]);

    if(existingProduct.length === 0){
      return res.status(404).json({success:false,message:"Product Not Found."})
    }

    // Delete old image if a new one is uploaded
    if (image && existingProduct[0].image) {
      const oldImagePath = path.join(uploadDir, existingProduct[0].image);
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
    }

    const updated_at=new Date();
    const [result]=await db.query(`UPDATE products 
       SET name = ?, description = ?, category_id = ?, hsn = ?, igst = ?, cgst = ?, sgst = ?, usage_unit_id = ?, inventory = ?, status = ?, updated_at = ?, image = COALESCE(?, image)
       WHERE id = ?`,
       [
        name,
        description || "",
        category_id,
        hsn,
        gst || 0,
        gst / 2 || 0,
        gst / 2 || 0,
        usage_unit_id,
        inventory,
        status,
        updated_at,
        image,
        id,
       ]);

       res.status(200).json({ success: true, message: "Product updated successfully." });
  } catch (error) {
     console.error("Error updating product:", error);
     res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

const deleteProduct=async(req,res)=>{
  try {
    const {id}=req.params;

    //check if product is exists?
    const [existingProduct]=await db.query(`SELECT * FROM products WHERE id = ?`,[id]);
    if(existingProduct.length === 0){
      return res.status(404).json({success:false,message:"Product Not Found."})
    }

    // Delete image from uploads folder if exists
    if(existingProduct[0].image){
      const imagePath=path.join(uploadDir, existingProduct[0].image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    // Delete product from database
    await db.query(`DELETE FROM products WHERE id = ?`, [id]);
    res.status(200).json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// Get single product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT 
         p.id, 
         p.name, 
         p.description, 
         p.category_id, 
         pc.name AS category_name,
         p.image, 
         p.hsn, 
         p.igst, 
         p.cgst, 
         p.sgst, 
         p.usage_unit_id, 
         pu.name AS usage_unit_name, 
         p.inventory, 
         p.status, 
         p.created_at, 
         p.updated_at
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN product_usage_unit pu ON p.usage_unit_id = pu.id
       WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


module.exports = { getProducts,getCategories,getUsageUnits,addProduct,uploadProductImage,updateProduct ,deleteProduct,getProductById};
