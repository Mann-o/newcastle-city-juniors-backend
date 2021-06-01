import Route from '@ioc:Adonis/Core/Route'

Route.get('/', async () => {
  return { hello: 'world' }
})

Route.group(() => {
  Route.group(() => {
    Route.group(() => {
      Route.post(
        '/presentation-2021-event',
        'StripeController.getPresentation2021EventPaymentIntent'
      )
    }).prefix('/payment-intents')

    Route.post('/create-checkout', 'StripeController.createCheckout')

    Route.post('/webhook-handler', 'StripeController.handleCheckoutWebhook')
  }).prefix('/stripe')
}).prefix('/api/v1')
