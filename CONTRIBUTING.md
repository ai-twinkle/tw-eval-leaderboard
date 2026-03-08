# Contributing to Twinkle Eval Leaderboard

Thank you for your interest in contributing to the Twinkle Eval Leaderboard! We welcome contributions from the community to help improve and expand this tool for comparing AI model performance.

## Ways to Contribute

### Reporting Bugs

- Use the [Bug Report](https://github.com/ai-twinkle/tw-eval-leaderboard/issues/new?template=01-bug-report.yml) issue template to report bugs.
- Provide detailed steps to reproduce the issue, expected behavior, and actual behavior.
- Include browser/console logs if applicable.

### Suggesting Features

- Use the [Feature Request](https://github.com/ai-twinkle/tw-eval-leaderboard/issues/new?template=02-feature-request.yml) issue template for new feature suggestions.
- Describe the feature, its use case, and why it would be valuable.

### Adding Benchmarks

- Use the [Add Taiwan Benchmark](https://github.com/ai-twinkle/tw-eval-leaderboard/issues/new?template=03-add-taiwan-benchmark.yml) issue template to suggest new Taiwan-related benchmarks.
- Provide detailed information about the benchmark dataset on HuggingFace.

### Code Contributions

- Fork the repository and create a feature branch.
- Make your changes and ensure tests pass.
- Submit a pull request with a clear description of the changes.

## Development Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/your-username/tw-eval-leaderboard.git
   cd tw-eval-leaderboard
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Initialize Husky (for pre-commit hooks):

   ```bash
   npx husky install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Code Guidelines

- Follow TypeScript strict mode.
- Use ESLint and Prettier for code formatting (automatically applied via Husky pre-commit hooks).
- Write meaningful commit messages.
- Add tests for new features.
- Ensure the application builds successfully.

## Pull Request Process

1. Update the README.md or documentation if needed.
2. Ensure your code follows the project's style guidelines.
3. Test your changes thoroughly.
4. Submit a pull request with a detailed description.
5. Wait for review and address any feedback.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## Questions?

If you have questions about contributing, feel free to open an issue or contact the maintainers.
