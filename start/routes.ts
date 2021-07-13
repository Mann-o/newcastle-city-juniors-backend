import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  // Authentication routes
  Route.group(() => {
    Route.post('/login', 'Auth/UserController.login')
    Route.post('/register', 'Auth/UserController.register')
    Route.post('/verify-email', 'Auth/UserController.verifyEmail')
    Route.get('/user', 'Auth/Usercontroller.getAuthenticatedUser').middleware('auth')
    Route.post('/logout', 'Auth/UserController.logout').middleware('auth')
  }).prefix('/auth')

  // Club routes
  Route.group(() => {
    // Players
    Route.group(() => {
      Route.get('/', 'Club/PlayerController.getAllPlayers')
      Route.post('/', 'Club/PlayerController.createPlayer')
      Route.get('/:playerId', 'Club/PlayerController.getPlayer')
    }).prefix('/players')

    // Teams
    Route.group(() => {
      Route.get('/', 'Club/TeamController.getAllTeams')
    }).prefix('teams')
  })
    .prefix('/club')
    .middleware('auth')

  // Stripe routes
  Route.group(() => {
    Route.group(() => {
      Route.post('/presentation-2021-event', 'Stripe/StripeController.getPresentation2021EventPaymentIntent')
    }).prefix('/payment-intents')

    Route.post('/create-checkout', 'Stripe/StripeController.createCheckout')
    Route.post('/webhook-handler', 'Stripe/StripeController.handleCheckoutWebhook')
    Route.get('/get-payments-for-user', 'Stripe/StripeController.getPaymentsForUser').middleware('auth')
  }).prefix('/stripe')
}).prefix('/api/v1')
