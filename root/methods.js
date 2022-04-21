const {
  SSMClient,
  GetParametersByPathCommand,
} = require("@aws-sdk/client-ssm");

const LoadParameters = function (barrel, next) {
  const client = new SSMClient();
  const command = new GetParametersByPathCommand({
    Path: `/canvas-${process.env.Environment}/sign/`,
    WithDecryption: true,
  });

  client.send(command).then((response) => {
    response.Parameters.forEach((p) => {
      if (p.Name === `/canvas-${process.env.Environment}/sign/mcuboot-cert`) {
        process.env.McuBootCert = p.Value;
      }
    });
    next(null, barrel);
  });
};

const ResponseConstructor = function (err, event, barrel, result) {
  this.statusCode = 200;
  this.headers = {
    // 'Cache-Control': 'max-age=0',
    "Cache-Control": "no-cache,no-store",
    "Content-Type": "application/json",
  };
  this.body = {};

  if (!isNaN(parseInt(process.env.MAX_AGE))) {
    // this.headers['Cache-Control'] = process.env.MAX_AGE
  }

  if (err) {
    this.statusCode = err.statusCode;
    this.body.error = err.body;
  } else if (result && typeof result === "object") {
    this.body = result;
  }

  if (process.env.Environment !== "prod") {
    if (barrel && barrel.STATUS) {
      this.body.status = barrel.STATUS;
    } else {
      this.body.status = [];
    }
  }
  if (barrel) {
    console.log(JSON.stringify(barrel.STATUS));
  }
  this.body = JSON.stringify(this.body);
  this.headers["Content-Length"] = this.body.length;

  return this;
};

const SanitizeBody = function (body) {
  // validate string
  // remove whitespace
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return body;
  }

  for (let k in body) {
    if (typeof body[k] === "string") {
      body[k] = body[k].trim();
      if (!/^(\w|\:){6,}$/.test(body[k]) && k === "unique_id") {
        throw new Error(
          `Invalid ${k}. Must be at leat 6 characters with allowed characters: a-z A-Z 0-9 _ :`
        );
      }
    }
  }
  return body;
};

const Barrel = function (event, context) {
  this.AWS_REGION = process.env.AWS_REGION;
  this.STATUS = [];
  if (context) {
    this.AWS_ACCOUNT = context.invokedFunctionArn.split(":")[4];
  }

  if (event) {
    this.HTTP_METHOD = event.httpMethod;

    try {
      if (typeof event.body === "string") {
        event.body = JSON.parse(event.body);
      }

      // silly, null type is object
      if (typeof event.body === "object" && event.body !== null) {
        this.BODY = SanitizeBody(event.body);
      } else {
        this.BODY = {};
      }
    } catch (error) {
      this.ERROR = {
        statusCode: 400,
        body: "Error: Bad Request, " + error.message,
      };
      this.BODY = {};
    }

    this.HEADERS = {};
    if (event.headers) {
      this.HEADERS = event.headers;
      try {
        this.TOKEN = decodeURIComponent(event.headers["Authorization"]);
      } catch (error) {
        this.TOKEN = event.headers["Authorization"];
      }
    }

    this.QUERY_PARAMETERS = event.queryStringParameters || {};
    for (const k in this.QUERY_PARAMETERS) {
      try {
        this.QUERY_PARAMETERS[k] = decodeURIComponent(this.QUERY_PARAMETERS[k]);
      } catch (error) {
        this.QUERY_PARAMETERS[k] = this.QUERY_PARAMETERS[k];
      }
    }

    this.PATH_PARAMETERS = event.pathParameters || {};
    for (const k in this.PATH_PARAMETERS) {
      try {
        this.PATH_PARAMETERS[k] = decodeURIComponent(this.PATH_PARAMETERS[k]);
      } catch (error) {
        this.PATH_PARAMETERS[k] = this.PATH_PARAMETERS[k];
      }
    }
  }
};

module.exports = {
  ResponseConstructor,
  Barrel,
  SanitizeBody,
  LoadParameters,
};
