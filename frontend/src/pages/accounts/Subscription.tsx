
const SubscriptionPage = () => {


const handleStartTrial = () => {
  
};

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-10 text-gray-800">
        Choose Your Subscription Plan
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* FREE PLAN */}
        <div className="bg-white border-2 border-blue-500 rounded-xl shadow-md p-8 text-center w-80">
          <h2 className="text-2xl font-semibold text-gray-800">Free Plan</h2>
          <p className="text-3xl font-bold text-blue-600 mt-4">$0</p>
          <p className="text-gray-500 mb-6">30-day free trial</p>

          <ul className="text-left text-gray-700 space-y-2 mb-6 mx-auto w-fit">
            <li>✔ Basic features</li>
            <li>✔ Limited usage</li>
            <li>✔ Email support</li>
          </ul>

          <button
            onClick={handleStartTrial}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition cursor-pointer"
          >
            Start Free Trial
          </button>
        </div>

        {/* PRO PLAN (DISABLED) */}
        <div className="bg-gray-200 border-2 border-gray-300 rounded-xl shadow-inner p-8 text-center w-80 opacity-60 cursor-not-allowed">
          <h2 className="text-2xl font-semibold text-gray-700">Pro Plan</h2>
          <p className="text-3xl font-bold text-gray-600 mt-4">
            PHP3,999/month
          </p>
          <p className="text-gray-500 mb-6">Coming Soon</p>

          <ul className="text-left text-gray-600 space-y-2 mb-6 mx-auto w-fit">
            <li>✔ All features unlocked</li>
            <li>✔ Unlimited usage</li>
            <li>✔ Priority support</li>
          </ul>

          <button
            disabled
            className="w-full py-3 bg-gray-400 text-white rounded-lg font-semibold"
          >
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
