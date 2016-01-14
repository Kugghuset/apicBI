
-- Filter variables
DECLARE @Now DateTime = GETDATE()
DECLARE @StartOfToday DateTime = DATEADD(day, DATEDIFF(day, 0, @Now), 0)

-- Variables to ultimately select
DECLARE @MaxWaitingTime Real
DECLARE @AverageWaitingTime Real
DECLARE @TotalNumberOfCalls Real
DECLARE @TotalAverageCallDurationSeconds Real
DECLARE @CallsLessThan60Seconds Real

SELECT @MaxWaitingTime =(MAX([tQueueWait]) / 1000)
      ,@AverageWaitingTime = (AVG([tQueueWait]) / 1000)
      ,@TotalNumberOfCalls = COUNT(*)
      ,@TotalAverageCallDurationSeconds = AVG([CallDurationSeconds])
FROM  [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [LocalUserId] != '-'
  AND [InitiatedDate] > @StartOfToday
  AND [InitiatedDate] <= @Now
  AND [ConnectedDate] != '1970-01-01 01:00:00.000'

SELECT @CallsLessThan60Seconds = (CAST(COUNT(*) AS Real) / @TotalNumberOfCalls) * 100
FROM  [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [LocalUserId] != '-'
  AND [InitiatedDate] > @StartOfToday
  AND [InitiatedDate] <= @Now
  AND [ConnectedDate] != '1970-01-01 01:00:00.000'
  AND ([tQueueWait] / 1000) < 60

SELECT
     @MaxWaitingTime                    AS [MaxWaitingTimeSeconds]
    ,@AverageWaitingTime                AS [AverageWaitingTimeSeconds]
    ,@TotalNumberOfCalls                AS [TotalNumberOfCalls]
    ,@TotalAverageCallDurationSeconds   AS [TotalAverageCallDurationSeconds]
    ,@CallsLessThan60Seconds            AS [CallsLessThan60SecondsPercent]
