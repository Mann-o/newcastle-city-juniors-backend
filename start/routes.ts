import Route from '@ioc:Adonis/Core/Route'

Route.get('/', () => 'NCJ server is up and running!')

Route.group(() => {
  Route.get('/', () => 'NCJ API server is up and running!')

  // Authentication routes
  Route.group(() => {
    Route.post('/login', 'Auth/UserController.login')
    Route.post('/register', 'Auth/UserController.register')
    Route.post('/verify-email', 'Auth/UserController.verifyEmail')
    Route.get('/user', 'Auth/UserController.getAuthenticatedUser').middleware('auth:api')
    Route.post('/logout', 'Auth/UserController.logout').middleware('auth:api')
    Route.post('/password-reset/start', 'Auth/UserController.startResetPassword')
    Route.post('/password-reset/finish', 'Auth/UserController.finishResetPassword')
    Route.post('/password-reset/cancel', 'Auth/UserController.cancelResetPassword')
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
    }).prefix('/teams')

    // Age Goups
    Route.group(() => {
      Route.get('/', 'Club/AgeGroupController.getAllAgeGroups')
    }).prefix('/age-groups')
  })
    .prefix('/club')
    .middleware('auth:api')

  // Stripe routes
  Route.group(() => {
    Route.group(() => {
      Route.post('/presentation-2021-event', 'Stripe/StripeController.getPresentation2021EventPaymentIntent')
    }).prefix('/payment-intents')

    Route.post('/create-checkout', 'Stripe/StripeController.createCheckout')
    Route.post('/webhook-handler', 'Stripe/StripeController.handleCheckoutWebhook')
    Route.get('/get-payments-for-user', 'Stripe/StripeController.getPaymentsForUser').middleware('auth:api')
    Route.post('/create-subscription', 'Stripe/StripeController.createSubscriptionForUser').middleware('auth:api')
    Route.post('/create-customer-portal-session', 'Stripe/StripeController.createCustomerPortalSession').middleware('auth:api')
  }).prefix('/stripe')

  // Helper routes
  Route.group(() => {
    Route.get('/payment-schedule-2021/one-off', 'Helpers/HelperController.getOneOffPaymentSchedule2021').middleware('auth:basic')
    Route.get('/payment-schedule-2021/subscriptions', 'Helpers/HelperController.getSubscriptionsPaymentSchedule2021').middleware(
      'auth:basic',
    )
  }).prefix('/helpers')
}).prefix('/api/v1')
