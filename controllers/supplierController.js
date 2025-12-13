const db = require("../config/db");

const getAllSuppliers = async (req, res) => {
  try {
    //Read pagination parameters from the HTTP query string:
    const page = parseInt(req.query.page, 10) || 1; //page — which page the client wants (default 1).
    const size = parseInt(req.query.size, 10) || 10; // size — how many items per page (default 10). (Good to default to a reasonable value.)
    const offset = (page - 1) * size; //offset - how many rows to skip for SQL pagination. OFFSET = (page - 1) * size. This is used in the LIMIT ? OFFSET ? clause.

    //Why: Pagination prevents returning thousands of rows at once and supports UI controls for pages.



    //Read other query options:
    const search = req.query.query || "";  //search — text to search inside supplier name or mobile. Default empty (no search).
    const status = req.query.status; // keep undefined vs ''. status — optional filter for u.status (may be "1", "0", "-1", or undefined).
    const sortKey = req.query.sort_key || "id"; //sortKey — which logical column the client wants to sort by; default "id".
    const sortOrder = req.query.sort_order === "desc" ? "DESC" : "ASC";  // sortOrder — sort direction; if client sends sort_order=desc then DESC else ASC.

    //Why: These let the front end request filtered/sorted/paged results for a better UX (search box, status filter, sortable headers).


    //allowedSort maps client-provided sort_key names to real, safe column names used in SQL (table-qualified).
    const allowedSort = {
      id: "u.id",
      name: "u.name",
      mobile: "u.mobile",
      grade: "up.grade",
      city: "c.name",
      pincode: "a.pincode",
      status: "u.status",
    };
    const orderBy = allowedSort[sortKey] || "u.id"; //orderBy picks the mapped column; if sortKey is not in the whitelist, it falls back to u.id.

    // Build WHERE with parameters to avoid SQL injection
    /* 
    Initialize an array of WHERE clauses and an empty params array for parameterized values.

    whereClauses starts with u.role_id = 3 so we only fetch suppliers (you said suppliers have role_id = 3).

    params will collect values that will replace ? placeholders in the SQL.

    Why: Building the WHERE as an array makes it easy to conditionally append filters and then join them with AND — and params keeps query inputs safe via parameter binding.
    */
    const whereClauses = ["u.role_id = 3"];
    const params = [];

    //Why: Building the WHERE as an array makes it easy to conditionally append filters and then join them with AND — and params keeps query inputs safe via parameter binding.


    /* 
    If search exists and is not empty:

    Add a clause to match u.name or u.mobile with SQL LIKE.

    Push two parameters (the %search% patterns) into params to be bound to the ? placeholders.

    Why: Parameterized LIKE ensures safe escaping and flexible substring search. The % around the search string means "contains".
    */

    if (search && search.trim().length > 0) {
      whereClauses.push("(u.name LIKE ? OR u.mobile LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }


    //If status was sent and is not an empty string: Add u.status = ? to filters and push the status value into params. 
    //Why: Allows filtering by status (active/inactive/pending). Using parameter binding keeps it safe.
    if (typeof status !== "undefined" && status !== "") {
      whereClauses.push("u.status = ?");
      params.push(status);
    }



    const whereSql = whereClauses.join(" AND "); //Join all whereClauses into a single string like: u.role_id = 3 AND (u.name LIKE ? OR u.mobile LIKE ?) AND u.status = ?
    //Why: Produces the final WHERE portion used by both the main query and the count query.




    // Main query
    const sql = `
      SELECT
        u.id, u.name, u.mobile, u.status,
        up.grade,
        a.pincode,
        c.name AS city
      FROM user u
      LEFT JOIN users_profile up ON u.id = up.user_id
      LEFT JOIN addresses a ON a.user_id = u.id AND a.user_type = 1 AND a.address_type = 1
      LEFT JOIN address_city c ON c.id = a.city_id
      WHERE ${whereSql}
      ORDER BY ${orderBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    // push pagination params after filters
    /* 
    Add the size and offset to params (these correspond to LIMIT ? OFFSET ? placeholders).

    Run the query via db.query(sql, params) which safely binds params to ? markers.

    rows is the array of supplier rows for the requested page.

    Why: Using parameter binding for all variable parts (except ORDER BY which was whitelisted) prevents injection and ensures correct escaping.
    */
    params.push(size, offset);

    const [rows] = await db.query(sql, params);

    // Count query (use same whereClauses)
    const countSql = `
      SELECT COUNT(*) AS total
      FROM user u
      LEFT JOIN users_profile up ON u.id = up.user_id
      LEFT JOIN addresses a ON a.user_id = u.id AND a.user_type = 1 AND a.address_type = 1
      LEFT JOIN address_city c ON c.id = a.city_id
      WHERE ${whereSql}
    `;
    const [countResult] = await db.query(countSql, params.slice(0, params.length - 2)); // exclude limit/offset

    return res.status(200).json({
      success: true,
      data: rows,
      total: countResult[0].total || 0,
    });
  } catch (error) {
    console.error("getAllSuppliers api error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getAllSuppliers };
