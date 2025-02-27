// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for apartments
const {Apartment, Request} = require('../models/apartment')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { apartment: { title: '', text: 'foo' } } -> { apartment: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET /apartments
router.get('/apartments', requireToken, (req, res, next) => {
  
  // Option 1 get user's apartments
  Apartment.find({owner: req.user.id})
    .then(apartments => res.status(200).json({apartments: apartments}))
    .catch(next)
  
  // // Option 2 get user's apartments
  // // must import User model and User model must have virtual for apartments
  // User.findById(req.user.id) 
    // .populate('apartments')
    // .then(user => res.status(200).json({ apartments: user.apartments }))
    // .catch(next)
})

// SHOW
// GET /apartments/5a7db6c74d55bc51bdf39793
router.get('/apartments/:id', requireToken, (req, res, next) => {
  // req.params.id will be set based on the `:id` in the route
  Apartment.findById(req.params.id)
    .then(handle404)
    // if `findById` is succesful, respond with 200 and "apartment" JSON
    .then(apartment => {
      // pass the `req` object and the Mongoose record to `requireOwnership`
      // it will throw an error if the current user isn't the owner
      requireOwnership(req, apartment)
    
      res.status(200).json({ apartment: apartment.toObject() })
    })
    // if an error occurs, pass it to the handler
    .catch(next)
})


router.post('/apartments/:id/requests', (req, res) => {


  var newReq = new Request(req.body.requests );
  

  Apartment.findById(req.params.id)
    .then(handle404)
    .then(apartment => {

      apartment.requests.push(newReq)
      apartment.save((err,savedApartment)=>{
      res.json(newReq);
      

      })
    })
    .catch(next)


});

// CREATE
// POST /apartments
router.post('/apartments', requireToken, (req, res, next) => {
  // set owner of new apartment to be current user
  console.log('the body', req.body)
  console.log('the user is', req.user)
  req.body.apartment.owner = req.user.id

  Apartment.create(req.body.apartment)
    // respond to succesful `create` with status 201 and JSON of new "apartment"
    .then(apartment => {
      res.status(201).json({ apartment: apartment.toObject() })
    })
    // if an error occurs, pass it off to our error handler
    // the error handler needs the error message and the `res` object so that it
    // can send an error message back to the client
    .catch(next)
})

// UPDATE
// PATCH /apartments/5a7db6c74d55bc51bdf39793
router.patch('/apartments/:id', requireToken, removeBlanks, (req, res, next) => {
  // if the client attempts to change the `owner` property by including a new
  // owner, prevent that by deleting that key/value pair
  delete req.body.apartment.owner

  Apartment.findById(req.params.id)
    .then(handle404)
    .then(apartment => {
      // pass the `req` object and the Mongoose record to `requireOwnership`
      // it will throw an error if the current user isn't the owner
      requireOwnership(req, apartment)

      // pass the result of Mongoose's `.update` to the next `.then`
      return apartment.update(req.body.apartment)
    })
    // if that succeeded, return 204 and no JSON
    .then(() => res.status(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// DESTROY
// DELETE /apartments/5a7db6c74d55bc51bdf39793
router.delete('/apartments/:id', requireToken, (req, res, next) => {
  Apartment.findById(req.params.id)
    .then(handle404)
    .then(apartment => {
      // throw an error if current user doesn't own `apartment`
      requireOwnership(req, apartment)
      // delete the apartment ONLY IF the above didn't throw
      apartment.remove()
    })
    // send back 204 and no content if the deletion succeeded
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

module.exports = router
