const jwt=require('jsonwebtoken'); //import json web token library

exports.protect=(req,res,next)=>{
    const token= req.headers.authorization?.split(" ")[1];
    //Reads the authorization header from the incoming HTTP request: req.headers.authorization.  The ?. is optional chaining: it safely handles the case where authorization might be undefined (so the code won't throw an error). .split(" ")[1] assumes the header is in the format Bearer <token> and takes the second part (<token>).

    //If token is missing (falsy), respond immediately with HTTP 401 Unauthorized and a JSON message "No Token, Auth Denied.".
    if(!token){
        return res.status(401).json({message:"No Token, Auth Denied."})
    }

    try{
        const decoded=jwt.verify(token,process.env.JWT_SECRET);//Uses jwt.verify to check that the token is valid and was signed with your JWT_SECRET (from environment variables).If valid, jwt.verify returns the decoded payload (the object you originally signed, e.g., { id, userName, email, iat, exp }), which we store in decoded.
        req.user=decoded; //Attaches the decoded payload to req.user so later middleware or the route handler can access the authenticated user's info (e.g., req.user.id).
        next();
    }
    catch(err){
        res.status(401).json({message:"Invalid Token"});
    }
}