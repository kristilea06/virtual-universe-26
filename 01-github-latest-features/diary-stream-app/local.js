const app = require('./server');
const port = process.env.PORT || 3000;

app.getDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Diary stream app running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Unable to connect to MongoDB:', error);
    process.exitCode = 1;
  });
