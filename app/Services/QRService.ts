import jsQr from 'jsqr'
import * as qrcode from 'qrcode'
import * as upng from 'upng-js'

export default class QRService {
  public static DEFAULT_QRCODE_OPTIONS = {
    type: 'png',
    margin: 2,
    width: 250,
  }

  public generateQRCode(dataStr: string, opts: qrcode.QRCodeOptions = {}): Promise<string> {
    const options = { ...QRService.DEFAULT_QRCODE_OPTIONS, ...opts }

    return qrcode.toDataURL(dataStr, options)
  }

  public decodeQRCode(buffer: ArrayBuffer): any {
    const image = upng.decode(buffer)
    const rgba = upng.toRGBA8(image)[0]

    return jsQr(new Uint8ClampedArray(rgba), image.width, image.height)
  }
}
