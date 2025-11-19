const db = require("../config/db");
const multer=require("multer");
const path=require("path");
const fs=require("fs");

//please check uploads folder have you created or not?
const uploadDir=path.join(__dirname,"../uploads");
if(!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir);
}

//multer storage for gst images
const storage=multer.diskStorage({
  destination:function(req,file,cb){
    cb(null,uploadDir)
  },
  filename:function(req,file,cb){
    const uniqueSuffix=Date.now()+"-"+Math.round(Math.random()*1e9)+ path.extname(file.originalname);
    cb(null,file.fieldname+"-"+uniqueSuffix);
  }
})

const allowedType = /jpeg|jpg|png|webp/;
const fileFilter = (req, file, cb) => {
  const extname = allowedType.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedType.test(file.mimetype);
  if (extname && mimetype) cb(null, true);
  else cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"));
};

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB per file
  fileFilter,
});

const uploadGstImages = upload.array("gst_images", 5); // field name 'gst_images', up to 5 files


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


const addCustomer = async (req, res) => {
  try {
    // multer middleware (uploadGstImages) will populate req.files and req.body
    const files = req.files || [];

    // Pull fields from req.body (they are strings when multipart/form-data)
    const {
      name,
      mobile,
      email,
      isRegisteredGSTIN,
      gstno,
      payment_term,
      status,
      // billing
      billing_address,
      billing_city_id,
      billing_pincode,
      billing_latitude,
      billing_longitude,
      billing_google_address,
      // shipping
      shipping_same_as_billing,
      shipping_address,
      shipping_city_id,
      shipping_pincode,
      shipping_latitude,
      shipping_longitude,
      shipping_google_address,
      // contact persons
      cp1_name,
      cp1_email,
      cp1_mobile,
      cp1_designation,
      cp2_name,
      cp2_email,
      cp2_mobile,
      cp2_designation,
    } = req.body;

    // Basic validation
    if (!name) {
      return res.status(400).json({ success: false, message: "Customer name is required." });
    }

    // store gst image filenames as JSON array (store names only)
    const gstFilenames = files.map((f) => f.filename);

    const created_at = new Date();
    const updated_at = new Date();

    // Insert into customers
    const [result] = await db.query(
      `INSERT INTO customers (name, email, mobile, gstin, gstin_url, payment_term, status, isRegisteredGSTIN, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email || null,
        mobile || null,
        gstno || null,
        gstFilenames.length > 0 ? JSON.stringify(gstFilenames) : null,
        payment_term ? parseInt(payment_term) : 0,
        status ? parseInt(status) : 1,
        isRegisteredGSTIN == "1" || isRegisteredGSTIN == 1 || isRegisteredGSTIN === true ? 1 : 0,
        created_at,
        updated_at,
      ]
    );

    const customerId = result.insertId;

    // Insert billing address (if provided)
    if (billing_address || billing_city_id) {
      await db.query(
        `INSERT INTO addresses (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerId,
          1,
          1,
          billing_address || "",
          billing_latitude ? parseFloat(billing_latitude) : null,
          billing_longitude ? parseFloat(billing_longitude) : null,
          billing_pincode || "",
          billing_google_address || "",
          billing_city_id || null,
          1,
          created_at,
          updated_at,
        ]
      );
    }

    // Insert shipping address
    const shippingFlag = shipping_same_as_billing == "1" || shipping_same_as_billing == 1 || shipping_same_as_billing === true;

    if (shippingFlag) {
      // copy billing into shipping (if billing present)
      if (billing_address || billing_city_id) {
        await db.query(
          `INSERT INTO addresses (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            customerId,
            1,
            1,
            billing_address || "",
            billing_latitude ? parseFloat(billing_latitude) : null,
            billing_longitude ? parseFloat(billing_longitude) : null,
            billing_pincode || "",
            billing_google_address || "",
            billing_city_id || null,
            1,
            created_at,
            updated_at,
          ]
        );
      } else {
        // if billing missing but shipping flag set, try inserting shipping fields
        if (shipping_address || shipping_city_id) {
          await db.query(
            `INSERT INTO addresses (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              customerId,
              1,
              1,
              shipping_address || "",
              shipping_latitude ? parseFloat(shipping_latitude) : null,
              shipping_longitude ? parseFloat(shipping_longitude) : null,
              shipping_pincode || "",
              shipping_google_address || "",
              shipping_city_id || null,
              1,
              created_at,
              updated_at,
            ]
          );
        }
      }
    } else {
      // insert shipping as provided
      if (shipping_address || shipping_city_id) {
        await db.query(
          `INSERT INTO addresses (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            customerId,
            1,
            1,
            shipping_address || "",
            shipping_latitude ? parseFloat(shipping_latitude) : null,
            shipping_longitude ? parseFloat(shipping_longitude) : null,
            shipping_pincode || "",
            shipping_google_address || "",
            shipping_city_id || null,
            1,
            created_at,
            updated_at,
          ]
        );
      }
    }

    // Insert contact persons (always attempt if provided)
    if (cp1_name) {
      await db.query(
        `INSERT INTO contact_person_info (parent_id, parent_type, name, email, mobile, designation, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customerId, "customer", cp1_name, cp1_email || null, cp1_mobile || null, cp1_designation || null, 1, created_at, updated_at]
      );
    }

    if (cp2_name) {
      await db.query(
        `INSERT INTO contact_person_info (parent_id, parent_type, name, email, mobile, designation, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customerId, "customer", cp2_name, cp2_email || null, cp2_mobile || null, cp2_designation || null, 1, created_at, updated_at]
      );
    }

    // All done — return success
    return res.status(201).json({ success: true, message: "Customer added successfully", customerId });
  } catch (error) {
    console.error("addCustomer error:", error);
    // If multer threw a file validation error it may be an Error; return 400 with message
    if (error && error.message && error.message.includes("Only image files")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



// const addCustomer=async(req,res)=>{
//   try {
//     const files=req.files || [];  // multer files available on req.files (gst_images).files becomes the array of uploaded file objects from multer.
//     const {
//       name,
//       mobile,
//       email,
//       isRegisteredGSTIN,
//       gstno,
//       payment_term,
//       status,
//       // billing
//       billing_address,
//       billing_city_id,
//       billing_pincode,
//       billing_latitude,
//       billing_longitude,
//       billing_google_address,
//       // shipping
//       shipping_same_as_billing,
//       shipping_address,
//       shipping_city_id,
//       shipping_pincode,
//       shipping_latitude,
//       shipping_longitude,
//       shipping_google_address,
//       // contact persons
//       cp1_name,
//       cp1_email,
//       cp1_mobile,
//       cp1_designation,
//       cp2_name,
//       cp2_email,
//       cp2_mobile,
//       cp2_designation,
//     } = req.body;

//     if(!name){
//       return res.status(400).json({success:false,message:"Customer name is required."})
//     }

//     // store gst image filenames as JSON array (store names only)
//     const gstFilenames=files.map((f)=> f.filename); //Build an array of just filenames for the saved GST images.

//     //Timestamps to store in DB (created/updated time).
//     const created_at=new Date();
//     const updated_at=new Date();


//     //insert into customers table
//     const [result]=await db.query(`INSERT INTO customers (name, email, mobile, gstin, gstin_url, payment_term, status, isRegisteredGSTIN, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,[
//       name,
//       email || null,
//       mobile || null,
//       gstno || null,
//       // isRegisteredGSTIN === "1" || isRegisteredGSTIN === 1 ? gstin || null : null,
//       gstFilenames.length > 0 ? JSON.stringify(gstFilenames) : null,
//       payment_term ? parseInt(payment_term) : 0,
//       status ? parseInt(status) : 1,
//       isRegisteredGSTIN == "1" || isRegisteredGSTIN == 1 || isRegisteredGSTIN === true ? 1 : 0,
//       created_at,
//       updated_at
//     ]);

//     const customerId = result.insertId; //result.insertId contains the newly created customer id; code stores it in customerId.

//     if(billing_address || billing_city_id){
//       await db.query(`INSERT INTO addresses (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[
//         customerId,
//         1,
//         1,
//         billing_address || "",
//         billing_latitude || "",
//         billing_longitude || "",
//         billing_pincode || "",
//         billing_google_address || "",
//         billing_city_id || null,
//         1,
//         created_at,
//         updated_at
//       ])
//     }

//     // Insert shipping address (if same_as_billing, reuse billing)
//     //If shipping_same_as_billing === "1" the code copies billing into shipping; otherwise it inserts shipping fields:
//     if(shipping_same_as_billing === "1" || shipping_same_as_billing === "1"){
//       //copy billing into shipping
//        if(billing_address || billing_city_id){
//         await db.query(`INSERT INTO addresses (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[
//           customerId,
//           "1",
//           "1",
//           billing_address || "",
//           billing_latitude || "",
//           billing_longitude || "",
//           billing_pincode || "",
//           billing_google_address || "",
//           billing_city_id || null,
//           1,
//           created_at,
//           updated_at
//         ])
//        }
//        else{
//         if(shipping_address || shipping_city_id){
//           await db.query(`INSERT INTO addresses (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[
//             customerId,
//             "1",
//             "1",
//             shipping_address || "",
//             shipping_latitude || "",
//             shipping_longitude || "",
//             shipping_pincode || "",
//             shipping_google_address || "",
//             shipping_city_id || null,
//             1,
//             created_at,
//             updated_at
//           ])
//         }
//        }

//         // Insert contact persons (cp1/cp2) if provided
//         if (cp1_name) {
//       await db.query(
//         `INSERT INTO contact_person_info (parent_id, parent_type, name, email, mobile, designation, status, created_at, updated_at)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//         [customerId, "customer", cp1_name, cp1_email || null, cp1_mobile || null, cp1_designation || null, 1, created_at, updated_at]
//       );
//     }

//     if (cp2_name) {
//       await db.query(
//         `INSERT INTO contact_person_info (parent_id, parent_type, name, email, mobile, designation, status, created_at, updated_at)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//         [customerId, "customer", cp2_name, cp2_email || null, cp2_mobile || null, cp2_designation || null, 1, created_at, updated_at]
//       );
//     }

//     return res.status(201).json({ success: true, message: "Customer added successfully", customerId });
//     }
//   } 
//   catch (error) {
//     console.error("addCustomer error:", error);
//     return res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// }


//get api for get all states
const getStates=async(req,res)=>{
  try {
    const [rows]=await db.query(`SELECT id,name FROM address_state WHERE status=1 ORDER BY name asc`);
    res.status(200).json({success:true,data:rows})
  } catch (error) {
    console.log("setState api error:- ",error);
    res.status(500).json({success:false,message:"Internal Server Error"})    
  }
}

//get api for get all districts
const getDistricts=async(req,res)=>{
  try {
    const {state_id}=req.params;
    const [rows]=await db.query(`SELECT id,name FROM address_district WHERE state_id=? AND status =1 ORDER BY name asc`,[state_id]);

    res.status(200).json({success:true,data:rows})
  } catch (error) {
    console.log("getDistricts api error:- ",error);
    res.status(500).json({success:false,message:"Internal Server Error"})    
  }
}

//get api for get taluka
const getTaluka=async(req,res)=>{
  try {
    const {district_id}=req.params;
    const [rows]=await db.query(`SELECT id , name FROM address_taluka WHERE district_id =? AND status =1 ORDER BY name ASC`,[district_id]);

    res.status(200).json({success:true,data:rows})
  } catch (error) {
    console.log("getTaluka api error:- ",error);
    res.status(500).json({success:false,message:"Internal Server Error."})    
  }
}

//get all cities
const getCities=async(req,res)=>{
  try {
    const {taluka_id}=req.params;
    const [rows]=await db.query(`SELECT id,name FROM address_city WHERE taluka_id =? AND status=1 ORDER BY name asc`,[taluka_id]);
    res.status(200).json({success:true,data:rows})
  } catch (error) {
    console.log("getCities api error:- ",error);
    res.status(500).json({success:false,message:"Internal Server Error."})    
  }
}
module.exports={getAllCustomers,getStates,getDistricts,getTaluka,getCities,addCustomer,uploadGstImages}