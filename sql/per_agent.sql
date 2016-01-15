
-- Filter variables
DECLARE @Now DateTime = GETDATE()
DECLARE @StartOfToday DateTime = DATEADD(day, DATEDIFF(day, 0, @Now), 0)
DECLARE @StartOfWeek DateTime = DATEADD(ww, DATEDIFF(ww, 1, @Now), 0)

SELECT [iDetails].[FirstName] + ' ' + [iDetails].[LastName] AS [AgentName]
      ,[cView].[TotalNumberOfCalls]
	  ,[avgCView].AverageNumberOfCallsByNow
      ,[cView].[AverageCallDurationSeconds]
	  ,[avgCView].AverageCallDurationSecondsByNow
FROM [SP_I3_IC].[dbo].[IndivDetails] AS [iDetails]

-- Inner join on [UserId]
INNER JOIN (
    SELECT [LocalUserId] AS [UserId]
          ,AVG([CallDurationSeconds]) AS [AverageCallDurationSeconds]
          ,COUNT(*) AS [TotalNumberOfCalls]
    FROM [SP_I3_IC].[dbo].[calldetail_viw]
    WHERE [LocalUserId] != '-'
      AND [CallDirection] = 'Inbound'
      AND [ConnectedDate] != '1970-01-01 01:00:00.000'
      AND [InitiatedDate] > @StartOfToday
      AND [InitiatedDate] <= @Now
    GROUP BY [LocalUserId]
    ) AS [cView]
ON [iDetails].[ICUserID] = [cView].[UserId]

-- Inner join on [UserId]
-- Selects all this week's calls grouped by [LocalUserId]
-- which are made up until the current hour of each day.
INNER JOIN (
	SELECT [LocalUserId] AS [UserId]
		  ,AVG([CallDurationSeconds]) AS [AverageCallDurationSecondsByNow]
		  ,CAST(
			ROUND(COUNT(*) * 1.00 / DATEDIFF(dd, @StartOfWeek, @Now), 0)
			AS Int) AS [AverageNumberOfCallsByNow] 
	FROM [SP_I3_IC].[dbo].[calldetail_viw]
	WHERE [LocalUserId] != '-'
	  AND [CallDirection] = 'Inbound'
	  AND [ConnectedDate] != '1970-01-01 01:00:00.000'
	  AND [InitiatedDate] > @StartOfWeek
	  AND [InitiatedDate] < @StartOfToday
	  AND [InitiatedDate] <=
                -- The date of [InitiatedDate] and the time of @Now
                -- are combined into a date string as such '2016-01-14 19:10'
                CONVERT(VARCHAR(10), [InitiatedDate], 120)
                + ' '
                + CONVERT(VARCHAR(5), @Now, 108)
	GROUP BY [LocalUserId]
) AS [avgCView]
ON [iDetails].[ICUserID] = [avgCView].[UserId]
