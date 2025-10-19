// Improved Trip Controller for better error handling
// This is a suggested improvement for your backend controller

const Trip = require('./models/Trip'); // Adjust path as needed

exports.addTrip = async (req, res) => {
  try {
    const tripData = req.body;
    
    // Log incoming data for debugging
    console.log('📝 Incoming trip data:', {
      userId: tripData.userId,
      motorId: tripData.motorId,
      destination: tripData.destination,
      distance: tripData.distance,
      actualDistance: tripData.actualDistance,
      hasRequiredFields: !!(tripData.userId && tripData.motorId && tripData.destination)
    });

    // Validate required fields
    const requiredFields = ['userId', 'motorId', 'destination', 'distance'];
    const missingFields = requiredFields.filter(field => !tripData[field] && tripData[field] !== 0);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields 
      });
    }

    // Validate data types
    if (typeof tripData.distance !== 'number' || tripData.distance < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Distance must be a non-negative number' 
      });
    }

    if (tripData.fuelUsedMin !== undefined && (typeof tripData.fuelUsedMin !== 'number' || tripData.fuelUsedMin < 0)) {
      return res.status(400).json({ 
        success: false, 
        message: 'fuelUsedMin must be a non-negative number' 
      });
    }

    if (tripData.fuelUsedMax !== undefined && (typeof tripData.fuelUsedMax !== 'number' || tripData.fuelUsedMax < 0)) {
      return res.status(400).json({ 
        success: false, 
        message: 'fuelUsedMax must be a non-negative number' 
      });
    }

    // Create and save trip
    const newTrip = new Trip(tripData);
    const savedTrip = await newTrip.save();
    
    console.log('✅ Trip created successfully:', {
      tripId: savedTrip._id,
      userId: savedTrip.userId,
      motorId: savedTrip.motorId,
      destination: savedTrip.destination
    });

    res.status(201).json({ 
      success: true, 
      trip: savedTrip,
      message: 'Trip saved successfully'
    });
  } catch (error) {
    console.error("❌ Error creating trip:", error);
    
    // Handle specific Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: validationErrors 
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Trip already exists with this data' 
      });
    }

    // Generic error
    res.status(500).json({ 
      success: false, 
      message: "Failed to create trip",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
