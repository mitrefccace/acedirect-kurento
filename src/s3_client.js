const S3 = require('aws-sdk/clients/s3');
const param = require('param');


/**
 * Defines a S3 client.
 *
 * @see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
 */
class S3Client {
  /**
   * Class constructor.
   *
   * @return {S3Client}
   */
  constructor() {
    this.s3 = new S3({
      accessKeyId: param('kurento.aws.s3.key'),
      secretAccessKey: param('kurento.aws.s3.secret'),
      region: param('kurento.aws.s3.region')
    });

    return this;
  }

  /**
   * Return a signed URL for file uploads
   * @param {String} action 'putObject|getObject'
   * @param {String} id the s3 Key
   *
   * @return {Promise}
   */
  getSignedUrl(action, id, p = {}) {
    return new Promise((resolve, reject) => {
      const params = { ...this.getS3ParamsForSignedUrl({ id }), ...p };
      return this.s3.getSignedUrl(action, params, (err, url) => {
        if (err) reject(err);
        resolve(url);
      });
    });
  }

  /**
   * Return the params for S3.getObject.
   *
   * @param {Object} args
   * @param {String} args.id
   * @param {String} args.bucket
   *
   * @return {Object}
   */
  getS3ParamsForSignedUrl(args) {
    return {
      Bucket: args.bucket || param('kurento.aws.s3.bucket'),
      Key: args.id
    };
  }

  /**
   * Return the params for S3.getObject.
   *
   * @param {Object} args
   * @param {String} args.id
   * @param {String} args.bucket
   *
   * @return {Object}
   */
  getS3ParamsForGetObjects(args) {
    return {
      Bucket: args.bucket || param('kurento.aws.s3.bucket'),
      Key: args.id
    };
  }

  /**
   * Get an object from S3 by id.
   *
   * @param {String} id
   *
   * @return {Promise} Resolves with the object (if exists).
   */
  getObjectById(id) {
    const s3GetObjectParams = this.getS3ParamsForGetObjects({ id });
    return this.s3GetObject(s3GetObjectParams);
  }

  /**
   * Get an object from S3.
   *
   * @param {Object} s3GetObjectParams @see getS3ParamsForGetObjects
   *
   * @return {Promise} Resolves with the S3 object (if founds).
   */
  s3GetObject(s3GetObjectParams) {
    return new Promise((resolve, reject) => {
      this.s3.getObject(
      s3GetObjectParams,
      this.getHandlerForS3GetObjectResponse(resolve, reject)
      );
    });
  }

  /**
   * Get the upload params for S3.upload used in the uploadBuffer method.
   *
   * @param {Object} args
   * @param {String} args.bucket
   * @param {String} args.fileName
   * @param {Buffer} args.buffer
   *
   * @return {Object}
   */
  getS3ParamsForUploadBuffer(args) {
    return {
      Bucket: args.bucket || param('kurento.aws.s3.bucket'),
      Key: args.fileName,
      Body: args.buffer
    };
  }

  /**
   * Get the upload params for S3.deleteObject used in the uploadBuffer method.
   *
   * @param {Object} args
   * @param {String} args.bucket
   * @param {String} args.fileName
   *
   * @return {Object}
   */
  getS3ParamsForDeleteObject(args) {
    return {
      Bucket: args.bucket || param('kurento.aws.s3.bucket'),
      Key: args.id
    };
  }

  /**
   * Delete a file from S3.
   *
   * @param {String} id a string representing the file Key
   *
   * @return {Promise} Resolves with the uploaded object.
   */
  s3Delete(id) {
    return new Promise((resolve, reject) => {
      const deleteParams = this.getS3ParamsForDeleteObject({ id });
      this.s3.deleteObject(
      deleteParams,
      this.getHandlerForS3DeleteResponse(resolve, reject)
      );
    });
  }


  /**
   * Upload a file to S3.
   *
   * @param {Object} s3UploadParams
   *
   * @return {Promise} Resolves with the uploaded object.
   */
  s3Upload(s3UploadParams) {
    return new Promise((resolve, reject) => {
      this.s3.upload(
      s3UploadParams,
      this.getHandlerForS3UploadResponse(resolve, reject)
      );
    });
  }

  /**
   * Returns the generic handler used in the responses from S3.
   *
   * @param {Function} resolve
   * @param {Function} reject
   *
   * @return {Function}
   */
  getGenericHandlerForS3Response(resolve, reject) {
    return (err, data) => {
      if (err) return reject(err);

      resolve(data);
    };
  }

  /**
   * Returns the handler used to handle the response of S3 getObject.
   *
   * @param {Function} resolve
   * @param {Function} reject
   *
   * @return {Function}
   */
  getHandlerForS3GetObjectResponse(resolve, reject) {
    return this.getGenericHandlerForS3Response(resolve, reject);
  }

  /**
   * Returns the handler used to handle the response of S3 upload.
   *
   * @param {Function} resolve
   * @param {Function} reject
   *
   * @return {Function}
   */
  getHandlerForS3UploadResponse(resolve, reject) {
    return this.getGenericHandlerForS3Response(resolve, reject);
  }

  /**
   * Returns the handler used to handle the response of S3 delete.
   *
   * @param {Function} resolve
   * @param {Function} reject
   *
   * @return {Function}
   */
  getHandlerForS3DeleteResponse(resolve, reject) {
    return this.getGenericHandlerForS3Response(resolve, reject);
  }

  /**
   * Upload buffer to bucket.
   *
   * @param {Object} uploadParams
   * @param {String} uploadParams.bucket
   * @param {String} uploadParams.fileName
   * @param {Buffer} uploadParams.buffer
   *
   * @return {Promise}
   */
  uploadBuffer(uploadParams) {
    const s3UploadParams = this.getS3ParamsForUploadBuffer(uploadParams);

    return this.s3Upload(s3UploadParams);
  }
}

module.exports = S3Client;