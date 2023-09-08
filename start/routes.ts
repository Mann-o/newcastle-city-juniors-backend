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
    // Parents
    Route.group(() => {
      Route.get('/', 'Club/ParentController.getAllParents')
      Route.post('/', 'Club/ParentController.createParent')
      Route.get('/:parentId', 'Club/ParentController.getParent')
    }).prefix('/parents')

    // Players
    Route.group(() => {
      Route.get('/', 'Club/PlayerController.getAllPlayers')
      Route.post('/', 'Club/PlayerController.createPlayer')
      Route.get('/:playerId', 'Club/PlayerController.getPlayer')
      Route.patch('/:playerId', 'Club/PlayerController.updatePlayer')
    }).prefix('/players')
  })
    .prefix('/club')
    .middleware('auth:api')

  // Admin routes
  Route.group(() => {
    Route.get('/players', 'Admin/PlayerController.getAllPlayers')
    Route.get('/player/:playerId/parent', 'Admin/PlayerController.getParentForPlayer')
    Route.post('/player/:playerId/toggle-wgs-registration', 'Admin/PlayerController.togglePlayerWgsRegistrationStatus')
    Route.get('/subscriptions-schedule', 'Admin/PlayerController.getSubscriptionsPaymentSchedule')
    Route.get('/verification-photos/:folder/:filename', 'Admin/MediaController.getVerificationPhoto')
    Route.get('/presentation-tickets-schedule', 'Admin/PlayerController.getPresentationTicketsPaymentSchedule')
  })
    .prefix('/admin')
    .middleware('auth:api')

  // Stripe routes
  Route.group(() => {
    Route.group(() => {
      Route.post('/presentation-2021-event', 'Stripe/StripeController.getPresentation2021EventPaymentIntent')
      Route.post('/summer-camp-2023', 'Stripe/StripeController.createSummerCamp2023PaymentIntent')
      Route.post('/footy-talk-in-2023', 'Stripe/StripeController.createFootyTalkIn2023PaymentIntent')
    }).prefix('/payment-intents')

    Route.post('/handle-webhook', 'Stripe/StripeHooksController.handleStripeWebhook')

    Route.get('/shoppable-products', 'Stripe/StripeController.getShoppableProducts')
    Route.get('/shop', 'Stripe/StripeController.getAllShoppableProducts')
    Route.post('/create-checkout', 'Stripe/StripeController.createCheckout')
    Route.get('/get-payments-for-user', 'Stripe/StripeController.getPaymentsForUser').middleware('auth:api')
    Route.post('/create-subscription', 'Stripe/StripeController.createSubscriptionForUser').middleware('auth:api')
    Route.post('/create-customer-portal-session', 'Stripe/StripeController.createCustomerPortalSession').middleware('auth:api')
    Route.post('/get-order', 'Stripe/StripeController.getOrder')
  }).prefix('/stripe')
}).prefix('/api/v1')
