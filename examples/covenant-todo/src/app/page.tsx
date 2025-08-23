export default function Home() {
  return (
    <div className="min-h-screen bg-base-100">
      {/* Hero Section */}
      <section className="hero min-h-screen bg-gradient-to-br from-primary to-secondary">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="mb-5 text-5xl font-bold text-white">Covenant Todo</h1>
            <p className="mb-5 text-lg text-white/90">
              The ultimate task management platform that transforms how teams collaborate and stay organized. Built for modern workflows with powerful automation and seamless integration.
            </p>
            <a href="/auth" className="btn btn-accent btn-lg">
              Get Started
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-base-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose Covenant Todo?</h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
              Streamline your workflow with cutting-edge features designed for productivity
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">🚀</div>
                <h3 className="card-title justify-center mb-2">Lightning Fast</h3>
                <p>Experience blazing-fast performance with our optimized architecture and real-time updates.</p>
              </div>
            </div>
            
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="card-title justify-center mb-2">Secure & Private</h3>
                <p>Your data is protected with enterprise-grade security and end-to-end encryption.</p>
              </div>
            </div>
            
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">🤝</div>
                <h3 className="card-title justify-center mb-2">Team Collaboration</h3>
                <p>Seamlessly collaborate with your team through shared workspaces and real-time sync.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-base-200">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to boost your productivity?</h2>
          <p className="text-lg text-base-content/70 mb-8 max-w-xl mx-auto">
            Join thousands of teams already using Covenant Todo to stay organized and achieve their goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/auth" className="btn btn-primary btn-lg">
              Start Free Trial
            </a>
            <button className="btn btn-outline btn-lg">
              View Demo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
