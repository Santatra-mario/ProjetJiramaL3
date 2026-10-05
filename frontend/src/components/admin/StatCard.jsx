import {
  TrendingUp,
  TriangleAlert,
  Info,
} from 'lucide-react';


function StatCard({

  title,

  value,

  subtitle,

  icon: Icon,

  iconBg =
    'bg-blue-50',

  iconColor =
    'text-blue-600',

  trend =
    'up',

}) {


  const isAlert =
    trend === 'alert';


  const isInfo =
    trend === 'info';


  const TrendIcon =
    isAlert
      ? TriangleAlert
      : isInfo
        ? Info
        : TrendingUp;


  const subtitleColor =
    isAlert
      ? 'text-red-600'
      : isInfo
        ? 'text-blue-600'
        : 'text-emerald-600';


  const iconTrendColor =
    isAlert
      ? 'text-red-500'
      : isInfo
        ? 'text-blue-500'
        : 'text-emerald-500';


  return (

    <div
      className="
        group
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
        transition
        duration-300
        hover:-translate-y-1
        hover:shadow-lg
      "
    >

      <div
        className="
          flex
          items-start
          justify-between
          gap-4
        "
      >

        <div
          className="
            min-w-0
          "
        >

          <p
            className="
              text-sm
              font-medium
              text-slate-500
            "
          >
            {
              title
            }
          </p>


          <p
            className="
              mt-2
              text-3xl
              font-bold
              tracking-tight
              text-slate-900
            "
          >
            {
              value
            }
          </p>


          <div
            className="
              mt-2
              flex
              items-center
              gap-1.5
            "
          >

            <TrendIcon

              size={
                14
              }

              className={
                iconTrendColor
              }

            />


            <span
              className={`
                text-xs
                font-semibold
                ${subtitleColor}
              `}
            >
              {
                subtitle
              }
            </span>

          </div>

        </div>


        <div
          className={`
            rounded-2xl
            p-3
            transition
            duration-300
            group-hover:scale-110
            ${iconBg}
          `}
        >

          {
            Icon && (

              <Icon

                size={
                  23
                }

                className={
                  iconColor
                }

              />

            )
          }

        </div>

      </div>

    </div>
  );
}


export default StatCard;