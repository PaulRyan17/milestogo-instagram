# milestogo-instagram

Automated Instagram posting for [@milestogoweb](https://www.instagram.com/milestogoweb/).

This repo holds:

- **A post queue** of upcoming posts (image + caption)
- **Image templates** used to generate the post images
- **A GitHub Actions workflow** that publishes to Instagram 3x a day via the Instagram API with Instagram Login

The access token is stored as the `IG_ACCESS_TOKEN` repository secret. It never goes in the code.
