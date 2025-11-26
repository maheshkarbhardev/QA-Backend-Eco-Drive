const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// UPLOAD FOLDER
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// MULTER STORAGE
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

const allowedType = /jpeg|jpg|png|webp/;
const fileFilter = (req, file, cb) => {
  const extname = allowedType.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedType.test(file.mimetype);
  if (extname && mimetype) cb(null, true);
  else cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"));
};

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter,
});

const uploadGstImages = upload.array("gst_images", 5);

// ======================================================================
// GET ALL CUSTOMERS
// ======================================================================
const getAllCustomers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,name,mobile,email,status FROM customers ORDER BY id desc`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.log("getAllCustomers API error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ======================================================================
// GET CUSTOMER BY ID
// ======================================================================
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const [customerRows] = await db.query(
      `SELECT * FROM customers WHERE id = ? LIMIT 1`,
      [id]
    );

    if (customerRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Customer Not Found" });
    }

    const customer = customerRows[0];

    // Parse GST Images
    try {
      if (customer.gstin_url) {
        const imgs = JSON.parse(customer.gstin_url || "[]");
        customer.gst_images = imgs.map(
          (img) => `${req.protocol}://${req.get("host")}/uploads/${img}`
        );
      } else {
        customer.gst_images = [];
      }
    } catch {
      customer.gst_images = [];
    }

    // Get addresses joined
    const [addressRows] = await db.query(
      `
      SELECT 
        a.*,
        c.id AS city_id, c.name AS city_name,
        t.id AS taluka_id, t.name AS taluka_name,
        d.id AS district_id, d.name AS district_name,
        s.id AS state_id, s.name AS state_name
      FROM addresses a
      LEFT JOIN address_city c ON c.id = a.city_id
      LEFT JOIN address_taluka t ON t.id = c.taluka_id
      LEFT JOIN address_district d ON d.id = t.district_id
      LEFT JOIN address_state s ON s.id = d.state_id
      WHERE a.user_id = ?
      ORDER BY a.address_type ASC
      `,
      [id]
    );

    const billing = addressRows.find((a) => a.address_type === 1) || {};
    const shipping = addressRows.find((a) => a.address_type === 2) || {};

    const [cpRows] = await db.query(
      `SELECT * FROM contact_person_info WHERE parent_id = ? ORDER BY id ASC`,
      [id]
    );

    const cp1 = cpRows[0] || {};
    const cp2 = cpRows[1] || {};

    return res.status(200).json({
      success: true,
      data: {
        customer,
        billing,
        shipping,
        cp1,
        cp2,
      },
    });
  } catch (error) {
    console.log("getCustomerById error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ======================================================================
// ADD CUSTOMER
// ======================================================================
const addCustomer = async (req, res) => {
  try {
    const files = req.files || [];

    const {
      name,
      mobile,
      email,
      isRegisteredGSTIN,
      gstno,
      payment_term,
      status,

      billing_address,
      billing_city_id,
      billing_pincode,
      billing_latitude,
      billing_longitude,
      billing_google_address,

      shipping_same_as_billing,
      shipping_address,
      shipping_city_id,
      shipping_pincode,
      shipping_latitude,
      shipping_longitude,
      shipping_google_address,

      cp1_name,
      cp1_email,
      cp1_mobile,
      cp1_designation,
      cp2_name,
      cp2_email,
      cp2_mobile,
      cp2_designation,
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Customer name is required." });
    }

    const gstFiles = files.map((f) => f.filename);

    const [result] = await db.query(
      `INSERT INTO customers (name, email, mobile, gstin, gstin_url, payment_term, status, isRegisteredGSTIN, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        name,
        email || null,
        mobile || null,
        gstno || null,
        gstFiles.length ? JSON.stringify(gstFiles) : null,
        payment_term || 0,
        status || 1,
        isRegisteredGSTIN == "1" ? 1 : 0,
      ]
    );

    const customerId = result.insertId;

    // INSERT BILLING (address_type 1)
    await db.query(
      `INSERT INTO addresses 
        (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        customerId,
        1,
        billing_address || "",
        billing_latitude || null,
        billing_longitude || null,
        billing_pincode || "",
        billing_google_address || "",
        billing_city_id || null,
      ]
    );

    // INSERT SHIPPING (address_type 2)
    await db.query(
      `INSERT INTO addresses 
        (user_id, user_type, address_type, address, latitude, longitude, pincode, google_address, city_id, status, created_at, updated_at)
       VALUES (?, ?, 2, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        customerId,
        1,
        shipping_address || "",
        shipping_latitude || null,
        shipping_longitude || null,
        shipping_pincode || "",
        shipping_google_address || "",
        shipping_city_id || null,
      ]
    );

    // CONTACT PERSON INSERTS
    if (cp1_name) {
      await db.query(
        `INSERT INTO contact_person_info (parent_id, parent_type, name, email, mobile, designation, status, created_at, updated_at)
         VALUES (?, 'customer', ?, ?, ?, ?, 1, NOW(), NOW())`,
        [customerId, cp1_name, cp1_email, cp1_mobile, cp1_designation]
      );
    }

    if (cp2_name) {
      await db.query(
        `INSERT INTO contact_person_info (parent_id, parent_type, name, email, mobile, designation, status, created_at, updated_at)
         VALUES (?, 'customer', ?, ?, ?, ?, 1, NOW(), NOW())`,
        [customerId, cp2_name, cp2_email, cp2_mobile, cp2_designation]
      );
    }

    return res.status(201).json({
      success: true,
      message: "Customer added successfully",
      customerId,
    });
  } catch (error) {
    console.log("addCustomer error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ======================================================================
// UPDATE CUSTOMER (FULLY FIXED)
// ======================================================================
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files || [];

    const {
      name,
      mobile,
      email,
      isRegisteredGSTIN,
      gstno,
      payment_term,
      status,

      billing_address,
      billing_city_id,
      billing_pincode,
      billing_latitude,
      billing_longitude,
      billing_google_address,

      shipping_address,
      shipping_city_id,
      shipping_pincode,
      shipping_latitude,
      shipping_longitude,
      shipping_google_address,

      cp1_name,
      cp1_email,
      cp1_mobile,
      cp1_designation,

      cp2_name,
      cp2_email,
      cp2_mobile,
      cp2_designation,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    let newGstImages = null;

    if (files.length > 0) {
      newGstImages = JSON.stringify(files.map((f) => f.filename));

      const [oldRows] = await db.query(
        `SELECT gstin_url FROM customers WHERE id = ?`,
        [id]
      );

      if (oldRows.length && oldRows[0].gstin_url) {
        const arr = JSON.parse(oldRows[0].gstin_url);
        arr.forEach((img) => {
          const imgPath = path.join(uploadDir, img);
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        });
      }
    }

    await db.query(
      `UPDATE customers SET 
         name=?, email=?, mobile=?, gstin=?, 
         gstin_url=?, payment_term=?, status=?, isRegisteredGSTIN=?, 
         updated_at=NOW()
       WHERE id=?`,
      [
        name,
        email || null,
        mobile || null,
        gstno || null,
        newGstImages,
        payment_term || 0,
        status || 1,
        isRegisteredGSTIN == "1" ? 1 : 0,
        id,
      ]
    );

    // UPDATE BILLING (address_type 1)
    await db.query(
      `UPDATE addresses SET 
         address=?, latitude=?, longitude=?, pincode=?, google_address=?, city_id=?, updated_at=NOW()
       WHERE user_id=? AND address_type=1`,
      [
        billing_address || "",
        billing_latitude || null,
        billing_longitude || null,
        billing_pincode || "",
        billing_google_address || "",
        billing_city_id || null,
        id,
      ]
    );

    // UPDATE SHIPPING (address_type 2)
    await db.query(
      `UPDATE addresses SET 
         address=?, latitude=?, longitude=?, pincode=?, google_address=?, city_id=?, updated_at=NOW()
       WHERE user_id=? AND address_type=2`,
      [
        shipping_address || "",
        shipping_latitude || null,
        shipping_longitude || null,
        shipping_pincode || "",
        shipping_google_address || "",
        shipping_city_id || null,
        id,
      ]
    );

    // RECREATE CONTACT PERSONS
    await db.query(`DELETE FROM contact_person_info WHERE parent_id=?`, [id]);

    if (cp1_name) {
      await db.query(
        `INSERT INTO contact_person_info 
         (parent_id, parent_type, name, email, mobile, designation, status, created_at, updated_at) 
         VALUES (?, 'customer', ?, ?, ?, ?, 1, NOW(), NOW())`,
        [id, cp1_name, cp1_email, cp1_mobile, cp1_designation]
      );
    }

    if (cp2_name) {
      await db.query(
        `INSERT INTO contact_person_info 
         (parent_id, parent_type, name, email, mobile, designation, status, created_at, updated_at) 
         VALUES (?, 'customer', ?, ?, ?, ?, 1, NOW(), NOW())`,
        [id, cp2_name, cp2_email, cp2_mobile, cp2_designation]
      );
    }

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
    });
  } catch (error) {
    console.log("updateCustomer error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ======================================================================
// DELETE CUSTOMER (with image cleanup)
// ======================================================================
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const [rows] = await db.query(
      `SELECT gstin_url FROM customers WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // -----------------------------
    // DELETE GST IMAGES FROM /uploads
    // -----------------------------
    if (rows[0].gstin_url) {
      try {
        const files = JSON.parse(rows[0].gstin_url);

        files.forEach((file) => {
          const filePath = path.join(uploadDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      } catch (err) {
        console.log("Error deleting GST images:", err);
      }
    }

    // -----------------------------
    // DELETE CONTACT PERSONS
    // -----------------------------
    await db.query(
      `DELETE FROM contact_person_info WHERE parent_id = ?`,
      [id]
    );

    // -----------------------------
    // DELETE ADDRESSES
    // -----------------------------
    await db.query(
      `DELETE FROM addresses WHERE user_id = ?`,
      [id]
    );

    // -----------------------------
    // DELETE CUSTOMER
    // -----------------------------
    await db.query(
      `DELETE FROM customers WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.log("deleteCustomer error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


// ======================================================================
// STATE / DISTRICT / TALUKA / CITY
// ======================================================================
const getStates = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,name FROM address_state WHERE status=1 ORDER BY name ASC`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.log("getStates error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getDistricts = async (req, res) => {
  try {
    const { state_id } = req.params;
    const [rows] = await db.query(
      `SELECT id,name FROM address_district WHERE state_id=? AND status=1 ORDER BY name ASC`,
      [state_id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.log("getDistricts error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getTaluka = async (req, res) => {
  try {
    const { district_id } = req.params;
    const [rows] = await db.query(
      `SELECT id,name FROM address_taluka WHERE district_id=? AND status=1 ORDER BY name ASC`,
      [district_id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.log("getTaluka error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getCities = async (req, res) => {
  try {
    const { taluka_id } = req.params;
    const [rows] = await db.query(
      `SELECT id,name FROM address_city WHERE taluka_id=? AND status=1 ORDER BY name ASC`,
      [taluka_id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.log("getCities error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  getAllCustomers,
  getStates,
  getDistricts,
  getTaluka,
  getCities,
  addCustomer,
  uploadGstImages,
  getCustomerById,
  updateCustomer,
  deleteCustomer
};
