<p align="center">
  <img src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/ec559a9f6bfd399b82bb44393651661b08aaf7ba/icons/folder-markdown-open.svg" width="100" alt="project-logo">
</p>
<p align="center">
    <h1 align="center">r2-img-host</h1>
</p>
<p align="center">
    <em>Empowering seamless image hosting, one code at a time.</em>
</p>
<p align="center">
	<img src="https://img.shields.io/github/license/Zxilly/r2ImgHost?style=default&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/Zxilly/r2ImgHost?style=default&logo=git&logoColor=white&color=0080ff" alt="last-commit">
	<img src="https://img.shields.io/github/languages/top/Zxilly/r2ImgHost?style=default&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/Zxilly/r2ImgHost?style=default&color=0080ff" alt="repo-language-count">
<p>

## Environment Variables

The service makes use of the following environment variables:

- `IMG_BUCKET`: This is an instance of an `R2Bucket` which is used for storing the uploaded images.
- `TOKEN`: This is an optional string variable used for authorization. If it is set, the service will check the 'Authorization' header of PUT requests to match this token.

## Endpoints

The service exposes the following HTTP endpoints:

### PUT `/:name`

This endpoint is used to upload an image to the service. The image name is passed as a parameter in the URL. The image data should be included in the body of the request. The 'Authorization' header should contain the `TOKEN` if it is set in the environment.

The service performs several checks on the uploaded file:

- The file size must not exceed 20 MB.
- The file extension must match the MIME type of the file.

If the file passes all checks, it is stored in the `IMG_BUCKET` with a SHA1 hash of the file name as the key. The service then returns a 201 response with the URL of the uploaded image.

### GET `/:hash`

This endpoint is used to retrieve an image from the service. The SHA1 hash of the image name is passed as a parameter in the URL.

If the image is found in the `IMG_BUCKET`, the service returns the image data with appropriate HTTP headers. The 'Cache-Control' header is set to allow caching of the image for 1 day after upload. After that, the image must be revalidated every hour.

## Error Responses

The service may return the following error responses:

- 401 'Unauthorized': The 'Authorization' header does not match the `TOKEN`.
- 413 'File too large': The uploaded file exceeds the size limit.
- 400 'File type not recognized': The file type of the uploaded file could not be recognized.
- 400 'Filename has no extension': The filename of the uploaded file does not have an extension.
- 400 'File type mismatch': The MIME type of the file does not match the file extension.
- 404 'Not Found': The requested image could not be found in the `IMG_BUCKET`.

## LICENSE

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
